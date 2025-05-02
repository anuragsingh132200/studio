"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogClose, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Video, Film, Merge, Trash2, MoreVertical, CheckCircle } from 'lucide-react';
import Image from 'next/image'; // Use next/image for optimized image loading

// Mock video type
interface RecordedVideo {
  id: string;
  url: string; // URL to the video blob or file
  thumbnail: string; // URL to a thumbnail image
  name: string;
  timestamp: number;
}

// Mock video data - Replace with actual video data fetching/management
const initialVideos: RecordedVideo[] = Array.from({ length: 6 }, (_, i) => ({
  id: `vid_${i + 1}`,
  url: '#', // Placeholder URL
  thumbnail: `https://picsum.photos/seed/${i + 1}/300/200`, // Placeholder thumbnail
  name: `Recording ${i + 1}.mp4`,
  timestamp: Date.now() - i * 1000 * 60 * 5, // Simulate different recording times
}));

export default function VideoVault() {
  const { toast } = useToast();
  const [videos, setVideos] = useState<RecordedVideo[]>(initialVideos);
  const [selectedVideos, setSelectedVideos] = useState<Set<string>>(new Set());
  const [isRecording, setIsRecording] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [isLongPressMode, setIsLongPressMode] = useState(false); // To track long press for selection
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  // --- Hydration Safety ---
  const [isClient, setIsClient] = useState(false);
  useEffect(() => {
    setIsClient(true);
  }, []);

  // --- Camera & Recording Logic ---
  const startRecording = async () => {
    if (!isClient || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast({ variant: "destructive", title: "Error", description: "Camera access not supported or denied." });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true; // Mute preview to avoid feedback
        videoRef.current.play();
      }

      mediaRecorderRef.current = new MediaRecorder(stream);
      recordedChunksRef.current = []; // Reset chunks

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const timestamp = Date.now();
        const newVideo: RecordedVideo = {
          id: `vid_${timestamp}`,
          url: url,
          // In a real app, generate a thumbnail from the video
          thumbnail: `https://picsum.photos/seed/${timestamp}/300/200`,
          name: `Recording ${new Date(timestamp).toLocaleString()}.webm`,
          timestamp: timestamp,
        };
        setVideos((prev) => [newVideo, ...prev]); // Add new video to the beginning
        toast({ title: "Success", description: "Video recorded successfully!" });

        // Clean up stream tracks
        stream.getTracks().forEach(track => track.stop());
        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      toast({ title: "Recording Started", description: "Press stop to finish recording." });
    } catch (error) {
      console.error("Error accessing camera:", error);
      toast({ variant: "destructive", title: "Camera Error", description: "Could not access camera. Please check permissions." });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      // Stream cleanup happens in onstop handler
    }
  };

  // --- Video Selection & Management ---
  const handleVideoSelect = (videoId: string) => {
    setSelectedVideos((prev) => {
      const newSelection = new Set(prev);
      if (newSelection.has(videoId)) {
        newSelection.delete(videoId);
      } else {
        newSelection.add(videoId);
      }
      // Exit long press mode if no videos are selected
      if (newSelection.size === 0) {
        setIsLongPressMode(false);
      }
      return newSelection;
    });
  };

  const handleVideoClick = (videoId: string) => {
    if (isLongPressMode) {
      handleVideoSelect(videoId);
    } else {
      // Play video logic (e.g., open in a modal or navigate to a player page)
      const video = videos.find(v => v.id === videoId);
      if(video) {
        // For now, just log or show a toast
        toast({ title: "Playing Video", description: `Opening ${video.name}` });
        // In a real app, you'd use a video player component/modal
        if(isClient) window.open(video.url, '_blank');
      }
    }
  };

  // Using useCallback for stable reference
  const handleLongPress = useCallback((videoId: string) => {
    if (!isLongPressMode) {
      setIsLongPressMode(true);
      setSelectedVideos(new Set([videoId])); // Start selection with the long-pressed item
    }
  }, [isLongPressMode]);


  const deleteSelectedVideos = () => {
    setVideos((prev) => prev.filter((video) => !selectedVideos.has(video.id)));
    setSelectedVideos(new Set());
    setIsLongPressMode(false); // Exit selection mode after deletion
    toast({ title: "Deleted", description: `${selectedVideos.size} video(s) deleted.` });
  };

  // --- Video Merging ---
  const mergeSelectedVideos = async () => {
    if (selectedVideos.size < 2) {
      toast({ variant: "destructive", title: "Merge Error", description: "Please select at least two videos to merge." });
      return;
    }
    setIsMerging(true);
    toast({ title: "Merging...", description: `Merging ${selectedVideos.size} videos. This might take a while.` });

    // Simulate merging process (replace with actual server-side or client-side merging logic)
    console.log("Merging videos:", Array.from(selectedVideos));
    await new Promise(resolve => setTimeout(resolve, 3000)); // Simulate delay

    // Simulate successful merge
    const timestamp = Date.now();
    const mergedVideo: RecordedVideo = {
      id: `merged_${timestamp}`,
      url: '#', // Placeholder for merged video URL
      thumbnail: `https://picsum.photos/seed/merged_${timestamp}/300/200`,
      name: `Merged Video ${new Date(timestamp).toLocaleTimeString()}.mp4`,
      timestamp: timestamp,
    };

    // Remove selected videos and add the merged one
    setVideos((prev) => [mergedVideo, ...prev.filter((video) => !selectedVideos.has(video.id))]);
    setSelectedVideos(new Set());
    setIsMerging(false);
    setIsLongPressMode(false); // Exit selection mode
    toast({ title: "Merge Successful", description: "Videos merged successfully!" });
  };

  const clearSelection = () => {
    setSelectedVideos(new Set());
    setIsLongPressMode(false);
  }

  // --- Long Press Handling ---
   // Custom hook for long press detection
   const useLongPress = (callback: (id: string) => void, ms = 300) => {
    const [startLongPress, setStartLongPress] = useState(false);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
      let timerId: NodeJS.Timeout;
      if (startLongPress) {
        timerId = setTimeout(() => {
           // Callback is called with null initially, update it when used
           // For now, let's assume the callback needs the ID which we pass in start/end handlers
        }, ms);
        timerRef.current = timerId;
      } else {
        if(timerRef.current) clearTimeout(timerRef.current);
      }

      return () => {
        if(timerRef.current) clearTimeout(timerRef.current);
      };
    }, [startLongPress, ms]); // Removed callback from dependencies

    const start = useCallback((event: React.TouchEvent<HTMLDivElement> | React.MouseEvent<HTMLDivElement>, id: string) => {
        event.preventDefault(); // Prevent context menu on desktop
        setStartLongPress(true);
         // Set up the timer to call the callback with the ID
         timerRef.current = setTimeout(() => {
            callback(id); // Call the actual long press handler
         }, ms);
    }, [callback, ms]); // Added callback dependency


    const stop = useCallback((event: React.TouchEvent<HTMLDivElement> | React.MouseEvent<HTMLDivElement>) => {
        event.preventDefault();
        setStartLongPress(false);
        if (timerRef.current) {
             clearTimeout(timerRef.current);
        }
    }, []);


    return {
      onMouseDown: (e: React.MouseEvent<HTMLDivElement>, id: string) => start(e, id),
      onMouseUp: stop,
      onMouseLeave: stop, // Clear timer if mouse leaves element
      onTouchStart: (e: React.TouchEvent<HTMLDivElement>, id: string) => start(e, id),
      onTouchEnd: stop,
    };
  };


  const longPressHandlers = useLongPress(handleLongPress);

  return (
    <div className="container mx-auto p-4 space-y-6">
      <h1 className="text-3xl font-bold text-center text-primary mb-6">VideoVault</h1>

      {/* Recording Section */}
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="text-primary" /> Record New Video
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center space-y-4">
          {isClient && isRecording && (
            <div className="w-full max-w-md aspect-video bg-secondary rounded-md overflow-hidden">
               {/* Ensure video element is only rendered client-side */}
               <video ref={videoRef} className="w-full h-full object-cover" playsInline></video>
            </div>
          )}
          {isClient && !isRecording && (
             <div className="w-full max-w-md aspect-video bg-secondary rounded-md flex items-center justify-center text-muted-foreground">
                <Film size={48} />
                <span className="ml-2">Camera Preview</span>
             </div>
          )}
          {!isClient && (
             <div className="w-full max-w-md aspect-video bg-secondary rounded-md flex items-center justify-center text-muted-foreground">
                <Film size={48} />
                <span className="ml-2">Loading Camera...</span>
             </div>
          )}

        </CardContent>
         <CardFooter className="flex justify-center">
             {isClient && (
               isRecording ? (
                 <Button variant="destructive" onClick={stopRecording} size="lg">
                   <div className="w-3 h-3 bg-white rounded-sm mr-2"></div> Stop Recording
                 </Button>
               ) : (
                 <Button onClick={startRecording} size="lg" className="bg-accent hover:bg-accent/90">
                   <Video className="mr-2" /> Start Recording
                 </Button>
               )
             )}
             {!isClient && (
                <Button size="lg" disabled>Loading...</Button>
             )}
         </CardFooter>
      </Card>

      {/* Gallery Section */}
      <Card className="shadow-md">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Film className="text-primary" /> Saved Videos ({videos.length})
          </CardTitle>
          {isLongPressMode && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{selectedVideos.size} selected</span>
               <Button variant="outline" size="sm" onClick={clearSelection}>Clear</Button>
               <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="destructive" size="sm" disabled={selectedVideos.size === 0}>
                       <Trash2 className="mr-1 h-4 w-4" /> Delete
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Confirm Deletion</DialogTitle>
                      <DialogDescription>
                        Are you sure you want to delete {selectedVideos.size} selected video(s)? This action cannot be undone.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <DialogClose asChild>
                         <Button variant="outline">Cancel</Button>
                      </DialogClose>
                      <DialogClose asChild>
                         <Button variant="destructive" onClick={deleteSelectedVideos}>Delete</Button>
                      </DialogClose>
                    </DialogFooter>
                  </DialogContent>
               </Dialog>
              <Button
                 variant="default"
                 size="sm"
                 className="bg-accent hover:bg-accent/90"
                 onClick={mergeSelectedVideos}
                 disabled={selectedVideos.size < 2 || isMerging}
              >
                <Merge className="mr-1 h-4 w-4" /> {isMerging ? 'Merging...' : 'Merge'}
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {videos.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No videos recorded yet. Start recording to see your videos here!</p>
          ) : (
            <ScrollArea className="h-[400px] w-full pr-4"> {/* Added ScrollArea */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {videos.map((video) => (
                  <Card
                    key={video.id}
                    className={`relative overflow-hidden shadow-sm transition-all duration-200 cursor-pointer hover:shadow-md ${selectedVideos.has(video.id) ? 'ring-2 ring-accent ring-offset-2' : ''}`}
                    onClick={() => handleVideoClick(video.id)}
                    {...longPressHandlers.onTouchStart && { onTouchStart: (e) => longPressHandlers.onTouchStart(e, video.id) }}
                    {...longPressHandlers.onTouchEnd && { onTouchEnd: longPressHandlers.onTouchEnd }}
                    {...longPressHandlers.onMouseDown && { onMouseDown: (e) => longPressHandlers.onMouseDown(e, video.id) }}
                    {...longPressHandlers.onMouseUp && { onMouseUp: longPressHandlers.onMouseUp }}
                    {...longPressHandlers.onMouseLeave && { onMouseLeave: longPressHandlers.onMouseLeave }} // Added onMouseLeave
                  >
                     {/* Selection Checkbox - visible only in long press mode */}
                    {isLongPressMode && (
                        <Checkbox
                           checked={selectedVideos.has(video.id)}
                           onCheckedChange={() => handleVideoSelect(video.id)}
                           className="absolute top-2 left-2 z-10 bg-background/80 data-[state=checked]:bg-accent data-[state=checked]:text-accent-foreground"
                           aria-label={`Select video ${video.name}`}
                        />
                    )}

                    <div className="aspect-video w-full relative">
                      <Image
                        src={video.thumbnail}
                        alt={video.name}
                        layout="fill"
                        objectFit="cover"
                        className="transition-transform duration-300 group-hover:scale-105"
                         data-ai-hint="video thumbnail tech"
                      />
                       {/* Play icon overlay */}
                       {!isLongPressMode && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                             <PlayIcon className="h-10 w-10 text-white" />
                          </div>
                       )}
                       {/* Selected Check Mark */}
                       {isLongPressMode && selectedVideos.has(video.id) && (
                            <div className="absolute inset-0 flex items-center justify-center bg-accent/70">
                                <CheckCircle className="h-10 w-10 text-white" />
                            </div>
                       )}
                    </div>
                    <CardFooter className="p-2 bg-card/90 backdrop-blur-sm">
                      <div className="flex justify-between items-center w-full">
                        <p className="text-xs font-medium truncate" title={video.name}>{video.name}</p>
                         {/* More Options - only visible if not in selection mode */}
                         {!isLongPressMode && (
                           <DropdownMenu>
                             <DropdownMenuTrigger asChild>
                               <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => e.stopPropagation()}>
                                 <MoreVertical className="h-4 w-4" />
                               </Button>
                             </DropdownMenuTrigger>
                             <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                               <DropdownMenuItem onClick={() => handleVideoClick(video.id)}>
                                 <PlayIcon className="mr-2 h-4 w-4" /> Play
                               </DropdownMenuItem>
                               <DropdownMenuItem
                                  className="text-destructive focus:text-destructive focus:bg-destructive/10"
                                  onClick={() => {
                                     setSelectedVideos(new Set([video.id])); // Select only this one for deletion
                                     // Trigger delete confirmation, maybe reuse the dialog logic?
                                     // For simplicity here, directly call delete logic (consider confirmation)
                                     deleteSelectedVideos(); // Note: This deletes based on the *updated* selectedVideos
                                     setSelectedVideos(new Set()); // Clear selection immediately after
                                  }}
                               >
                                 <Trash2 className="mr-2 h-4 w-4" /> Delete
                               </DropdownMenuItem>
                             </DropdownMenuContent>
                           </DropdownMenu>
                         )}
                      </div>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


// Simple Play Icon Component
function PlayIcon(props: React.SVGProps<SVGSVGElement>) {
   return (
     <svg
       {...props}
       xmlns="http://www.w3.org/2000/svg"
       width="24"
       height="24"
       viewBox="0 0 24 24"
       fill="none"
       stroke="currentColor"
       strokeWidth="2"
       strokeLinecap="round"
       strokeLinejoin="round"
     >
       <polygon points="5 3 19 12 5 21 5 3" />
     </svg>
   )
 }
