import React,{useEffect, useCallback,useState,useRef} from 'react'
import { useSocket } from '../context/SocketProvider';
import ReactPlayer from 'react-player';
import peer from "../service/peer";


const RoomPage =()=>{

    const socket = useSocket();

    const [myStream,setMyStream]= useState();
    const [remoteStream,setRemoteStream]= useState();
    const [remoteSocketId,setRemoteSocketId]= useState(null);
  const [isStreamSent, setIsStreamSent] = useState(false);
  const [isRemoteStreamActive, setIsRemoteStreamActive] = useState(false);
  const [callInitiated, setCallInitiated] = useState(false);

  const [dataChannel, setDataChannel] = useState(null); //this is added

  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const isDrawing = useRef(false); //this is added



    const handleCallUser = useCallback(async ()=> {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio:true,
            video: true,
        });
        const offer= await peer.getOffer();

        const dataChannel = peer.peer.createDataChannel('canvas');
        setDataChannel(dataChannel);

        dataChannel.onmessage = (event) => {
            const { type, x, y } = JSON.parse(event.data);
            if (type === 'draw') drawOnCanvas(x, y);
            if (type === 'begin') startDrawingRemote(x, y);
            if (type === 'end') stopDrawingRemote();
        };

        socket.emit("user:call",{to: remoteSocketId,offer});
        setMyStream(stream);
        setCallInitiated(true);
    },[remoteSocketId,socket]);


    const handleNegotiationIncomming=useCallback(async ({from,offer})=>{
        const ans=await peer.getAnswer(offer);
        socket.emit("peer:nego:done",{to:from,ans})
    },[socket])

    const sendStreams=useCallback(()=>{
        
        for(const track of myStream.getTracks()){
            peer.peer.addTrack(track,myStream);
        }
        setIsStreamSent(true);
    },[myStream]);

    const handleCallAccepted=useCallback((from,ans)=>{
        peer.setLocalDescription(ans)
        console.log("call accepted ");
        sendStreams();

        peer.peer.ondatachannel = (event) => {
            const channel = event.channel;
            setDataChannel(channel);

            channel.onmessage = (event) => {
                const { type, x, y } = JSON.parse(event.data);
                if (type === 'draw') drawOnCanvas(x, y);
                if (type === 'begin') startDrawingRemote(x, y);
                if (type === 'end') stopDrawingRemote();
            };
        };//this is added

    },[sendStreams])

    const handleNegoNeedFinal=useCallback(async({ans})=>{
        await peer.setLocalDescription(ans); 
    },[])

    const handleIncommingCall=useCallback(async({from,offer}) =>{
        setRemoteSocketId(from);
        console.log(`Incomming Call`,from,offer);
        const stream = await navigator.mediaDevices.getUserMedia({
            audio:true,
            video: true,
        });
        setMyStream(stream);
        const ans = await peer.getAnswer(offer);
        socket.emit("call:accepted",{to:from,ans});
    },[socket]);

    const handleUserJoined = useCallback(({email,id})=>{
        console.log(`email here refeered is ${email} joined room`)
        setRemoteSocketId(id);
    },[]);

    const handleNegotiationNeeded=useCallback(async ()=>{
        const offer= await peer.getOffer();
        socket.emit("peer:nego:needed",{offer,to:remoteSocketId})

    },[remoteSocketId,socket])


    const startDrawing = (e) => {
        isDrawing.current = true;
        const { offsetX, offsetY } = e.nativeEvent;
        ctxRef.current.beginPath();
        ctxRef.current.moveTo(offsetX, offsetY);

        if (dataChannel) {
            dataChannel.send(JSON.stringify({ type: 'begin', x: offsetX, y: offsetY }));
        }
    };//this is added


    const draw = (e) => {
        if (!isDrawing.current) return;
        const { offsetX, offsetY } = e.nativeEvent;
        ctxRef.current.lineTo(offsetX, offsetY);
        ctxRef.current.stroke();

        if (dataChannel) {
            dataChannel.send(JSON.stringify({ type: 'draw', x: offsetX, y: offsetY }));
        }
    };//this is added



    const stopDrawing = () => {
        isDrawing.current = false;
        ctxRef.current.closePath();


        if(dataChannel){
        if (dataChannel.readyState==='open') {//(.readyState==='open') was added by me
            dataChannel.send(JSON.stringify({ type: 'end' }));
        }
    }
    };///this is added

    const startDrawingRemote = (x, y) => {
        ctxRef.current.beginPath();
        ctxRef.current.moveTo(x, y);
    };//this is added

    const drawOnCanvas = (x, y) => {
        ctxRef.current.lineTo(x, y);
        ctxRef.current.stroke();
    };//this is added

    const stopDrawingRemote = () => {
        ctxRef.current.closePath();
    };//this is added


    useEffect(() => {
        const canvas = canvasRef.current;
        canvas.width = 400;
        canvas.height = 300;
        const ctx = canvas.getContext('2d');
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 2;
        ctxRef.current = ctx;
    }, []);



    useEffect(()=>{
        peer.peer.addEventListener("negotiationneeded",handleNegotiationNeeded);
        return ()=>{
            peer.peer.removeEventListener("negotiationneeded",handleNegotiationNeeded)
        }
    },[handleNegotiationNeeded]);


    useEffect(()=>{
        peer.peer.addEventListener('track',async (ev) =>{
            const remoteStream = ev.streams;
            console.log("GOT TRACKS!!!");
            setRemoteStream(remoteStream[0]);
            setIsRemoteStreamActive(true); 
        })
    },[]);



    useEffect(()=>{
        socket.on('user:joined',handleUserJoined)
        socket.on('incomming:call',handleIncommingCall);
        socket.on('call:acepted',handleCallAccepted);
        socket.on("peer:nego:needed",handleNegotiationIncomming)
        socket.on("peer:nego:final",handleNegoNeedFinal)

        return ()=>{
            socket.off('incomming:call',handleIncommingCall);
            socket.off('user:joined',handleUserJoined);
            socket.off('call:acepted',handleCallAccepted);
            socket.off("peer:nego:needed",handleNegotiationIncomming);
            socket.off("peer:nego:final",handleNegoNeedFinal);

        }
    }, [socket,handleUserJoined,handleIncommingCall,handleNegoNeedFinal,handleNegotiationIncomming,handleCallAccepted]);

    return(
        <div>
            <h1>Room Page</h1>
            <h4>{remoteSocketId ? 'Connected' : "no one in room"}</h4>
            {
                !callInitiated &&  remoteSocketId && <button onClick={handleCallUser}>CALL</button>
            }
            {
                !isStreamSent && myStream && <button onClick={sendStreams} >Send Stream</button>
            }
            {
                myStream &&(
                <>
                <h5>my Stream</h5>
                <ReactPlayer 
                playing
                 muted 
                 height="150px" 
                 width="300px" 
                 url={myStream}/>
                </>
                )
            }
            {
                remoteStream &&
                (
                <>
                <h5>Remote Stream</h5>                    
                <ReactPlayer 
                playing
                 muted 
                 height="150px" 
                 width="300px" 
                 url={remoteStream}/>
                </>
                )
            }
            <h5>Shared Canvas</h5>
            <canvas
                ref={canvasRef}
                style={{ border: '2px solid blue' }}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseOut={stopDrawing}
            />

            </div>
    )

}

export default RoomPage;