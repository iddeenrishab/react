import React,{useEffect, useCallback,useState} from 'react'
import { useSocket } from '../context/SocketProvider';
import ReactPlayer from 'react-player';
import peer from "../service/peer";


const RoomPage =()=>{

    const socket = useSocket();

    const [myStream,setMyStream]= useState();
    const [remoteStream,setRemoteStream]= useState();
    const [remoteSocketId,setRemoteSocketId]= useState(null);
    const handleCallUser = useCallback(async ()=> {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio:true,
            video: true,
        });
        const offer= await peer.getOffer();
        socket.emit("user:call",{to: remoteSocketId,offer});
        setMyStream(stream);
    },[remoteSocketId,socket]);


    const handleNegotiationIncomming=useCallback(async ({from,offer})=>{
        const ans=await peer.getAnswer(offer);
        socket.emit("peer:nego:done",{to:from,ans})
    },[socket])

    const sendStreams=useCallback(()=>{
        
        for(const track of myStream.getTracks()){
            peer.peer.addTrack(track,myStream);
        }
    },[myStream]);

    const handleCallAccepted=useCallback((from,ans)=>{
        peer.setLocalDescription(ans)
        console.log("call accepted ");
        sendStreams();
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
                remoteSocketId && <button onClick={handleCallUser}>CALL</button>
            }
            {
                myStream && <button onClick={sendStreams} >Send Stream</button>
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
            </div>
    )

}

export default RoomPage;