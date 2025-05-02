"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogClose, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Video, Film, Merge, Trash2, MoreVertical, CheckCircle, AlertTriangle } from 'lucide-react';
import Image from 'next/image'; // Use next/image for optimized image loading
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // Import Alert components


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
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null); // null = pending, true = granted, false = denied
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null); // Ref to hold the stream

  // --- Hydration Safety ---
  const [isClient, setIsClient] = useState(false);
  useEffect(() => {
    setIsClient(true);
  }, []);

  // --- Camera Permission Logic ---
  useEffect(() => {
    if (!isClient || !navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
       // Handle cases where mediaDevices or getUserMedia is not available
       if (isClient) {
           setHasCameraPermission(false);
           toast({
             variant: 'destructive',
             title: 'Unsupported Browser',
             description: 'Your browser does not support camera access.',
           });
       }
       return;
    }

    let active = true; // Flag to prevent state updates if component unmounts

    const getCameraPermission = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (!active) {
            // Stop tracks if component unmounted before state update
            stream.getTracks().forEach(track => track.stop());
            return;
        }
        streamRef.current = stream; // Store the stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          // No need to call play here if using autoPlay
        }
        setHasCameraPermission(true);
      } catch (error) {
        console.error('Error accessing camera:', error);
         if (!active) return;
        setHasCameraPermission(false);
        toast({
          variant: 'destructive',
          title: 'Camera Access Denied',
          description: 'Please enable camera permissions in your browser settings to record video.',
        });
      }
    };

    getCameraPermission();

    // Cleanup function
     return () => {
        active = false; // Mark as inactive
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }
     };
  }, [isClient, toast]); // Add toast to dependency array


  // --- Recording Logic ---
  const startRecording = () => {
     if (!isClient || !hasCameraPermission || !streamRef.current) {
       toast({ variant: "destructive", title: "Error", description: "Camera not available or permission denied." });
       return;
     }

     try {
       // Use the existing stream from the ref
       mediaRecorderRef.current = new MediaRecorder(streamRef.current);
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

         // DO NOT stop the stream tracks here, as the preview should continue
         // The stream is stopped in the useEffect cleanup when the component unmounts
       };

       mediaRecorderRef.current.start();
       setIsRecording(true);
       toast({ title: "Recording Started", description: "Press stop to finish recording." });
     } catch (error) {
        console.error("Error starting recording:", error);
        toast({ variant: "destructive", title: "Recording Error", description: "Could not start recording." });
        setIsRecording(false); // Ensure state is reset on error
     }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      // Stream cleanup is handled by the useEffect hook on unmount
      // or when permission is revoked/changed.
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
        toast({ title: "Opening Video", description: `Opening ${video.name}` });
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
    // Optional: Clean up Blob URLs before removing videos
     selectedVideos.forEach(id => {
         const video = videos.find(v => v.id === id);
         if (video && video.url.startsWith('blob:')) {
             URL.revokeObjectURL(video.url);
         }
     });

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

    // Optional: Clean up Blob URLs of merged videos
    selectedVideos.forEach(id => {
        const video = videos.find(v => v.id === id);
        if (video && video.url.startsWith('blob:')) {
            URL.revokeObjectURL(video.url);
        }
    });

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
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const isLongPressTriggeredRef = useRef(false); // Track if long press already triggered

    const start = useCallback((event: React.TouchEvent<HTMLDivElement> | React.MouseEvent<HTMLDivElement>, id: string) => {
        // Don't prevent default on mouse down, it breaks clicking
        // event.preventDefault();
        isLongPressTriggeredRef.current = false; // Reset trigger flag
         // Set up the timer to call the callback with the ID
         timerRef.current = setTimeout(() => {
             callback(id); // Call the actual long press handler
             isLongPressTriggeredRef.current = true; // Mark as triggered
         }, ms);
    }, [callback, ms]);


    const stop = useCallback((event: React.TouchEvent<HTMLDivElement> | React.MouseEvent<HTMLDivElement>, isClick: boolean = false) => {
        // Don't prevent default on mouse up / touch end if it's meant to be a click
        // Only prevent default if the long press was actually triggered to avoid unwanted actions
        if (isLongPressTriggeredRef.current && !isClick) {
           event.preventDefault();
        }

        if (timerRef.current) {
             clearTimeout(timerRef.current);
             timerRef.current = null;
        }
        // Reset trigger flag on stop, regardless of whether it fired
        // isLongPressTriggeredRef.current = false; // Keep this reset logic if needed elsewhere, or remove if only needed in start
    }, []);

    const handleClick = (event: React.MouseEvent<HTMLDivElement>, id: string) => {
        // If the long press timer was cleared (i.e., it was a short press/click)
        // and long press didn't trigger, proceed with the normal click action.
        if (!isLongPressTriggeredRef.current) {
            handleVideoClick(id); // Call your existing click handler
        }
        // Stop propagation might be needed depending on nested elements
        // event.stopPropagation();
        stop(event, true); // Ensure timer is cleared even on click
    };


    return {
      onMouseDown: (e: React.MouseEvent<HTMLDivElement>, id: string) => start(e, id),
      onMouseUp: (e: React.MouseEvent<HTMLDivElement>) => stop(e),
      onClick: (e: React.MouseEvent<HTMLDivElement>, id: string) => handleClick(e, id), // Use onClick for reliable click handling
      onMouseLeave: (e: React.MouseEvent<HTMLDivElement>) => stop(e), // Clear timer if mouse leaves element
      onTouchStart: (e: React.TouchEvent<HTMLDivElement>, id: string) => start(e, id),
      onTouchEnd: (e: React.TouchEvent<HTMLDivElement>) => stop(e),
      // Prevent context menu on long press for touch devices implicitly via preventDefault in start? No, handle context menu separately if needed.
      // onContextMenu: (e: React.MouseEvent<HTMLDivElement>) => e.preventDefault(), // Optional: explicitly prevent context menu
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
           {/* Always render video element for stability */}
           <div className="w-full max-w-md aspect-video bg-secondary rounded-md overflow-hidden flex items-center justify-center">
               <video ref={videoRef} className="w-full h-full object-cover" playsInline autoPlay muted></video>
           </div>

           {/* Show alert only if permission is denied (after check) */}
           {isClient && hasCameraPermission === false && (
              <Alert variant="destructive" className="w-full max-w-md">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Camera Access Required</AlertTitle>
                  <AlertDescription>
                     Please allow camera access in your browser settings to record videos.
                  </AlertDescription>
              </Alert>
           )}
           {/* Show loading/placeholder when permission check is pending */}
            {isClient && hasCameraPermission === null && (
                <div className="w-full max-w-md text-center text-muted-foreground">Checking camera permissions...</div>
            )}

        </CardContent>
         <CardFooter className="flex justify-center">
             {isClient && (
               isRecording ? (
                 <Button variant="destructive" onClick={stopRecording} size="lg">
                   <div className="w-3 h-3 bg-white rounded-sm mr-2"></div> Stop Recording
                 </Button>
               ) : (
                 <Button
                     onClick={startRecording}
                     size="lg"
                     className="bg-accent hover:bg-accent/90"
                     disabled={!hasCameraPermission || isRecording} // Disable if no permission or already recording
                 >
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
            <div className="flex items-center gap-2 flex-wrap"> {/* Added flex-wrap */}
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
                    className={`relative group overflow-hidden shadow-sm transition-all duration-200 cursor-pointer hover:shadow-md ${selectedVideos.has(video.id) ? 'ring-2 ring-accent ring-offset-2' : ''}`}
                    // Apply long press handlers using spread syntax
                     {...longPressHandlers.onMouseDown && { onMouseDown: (e) => longPressHandlers.onMouseDown(e, video.id) }}
                     {...longPressHandlers.onMouseUp && { onMouseUp: (e) => longPressHandlers.onMouseUp(e) }}
                     {...longPressHandlers.onClick && { onClick: (e) => longPressHandlers.onClick(e, video.id) }} // Use onClick from hook
                     {...longPressHandlers.onMouseLeave && { onMouseLeave: (e) => longPressHandlers.onMouseLeave(e) }}
                     {...longPressHandlers.onTouchStart && { onTouchStart: (e) => longPressHandlers.onTouchStart(e, video.id) }}
                     {...longPressHandlers.onTouchEnd && { onTouchEnd: (e) => longPressHandlers.onTouchEnd(e) }}
                     // {...longPressHandlers.onContextMenu && { onContextMenu: longPressHandlers.onContextMenu }} // Add if using context menu prevention
                  >
                     {/* Selection Checkbox - visible only in long press mode */}
                    {isLongPressMode && (
                        <Checkbox
                           checked={selectedVideos.has(video.id)}
                           // Prevent click propagation to the card's onClick when interacting with checkbox
                           onClick={(e) => e.stopPropagation()}
                           onCheckedChange={(checked) => {
                               // Explicitly handle checkbox change without relying on card click
                               handleVideoSelect(video.id);
                           }}
                           className="absolute top-2 left-2 z-10 bg-background/80 data-[state=checked]:bg-accent data-[state=checked]:text-accent-foreground"
                           aria-label={`Select video ${video.name}`}
                        />
                    )}

                    <div className="aspect-video w-full relative">
                      <Image
                        src={video.thumbnail}
                        alt={video.name}
                        fill // Use fill instead of layout="fill"
                        sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw" // Add sizes prop
                        style={{ objectFit: 'cover' }} // Use style prop for objectFit
                        className="transition-transform duration-300 group-hover:scale-105"
                         data-ai-hint="video thumbnail tech abstract" // Updated hint
                         priority={initialVideos.slice(0, 4).some(v => v.id === video.id)} // Prioritize loading for first few images
                      />
                       {/* Play icon overlay */}
                       {!isLongPressMode && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                             <PlayIcon className="h-10 w-10 text-white" />
                          </div>
                       )}
                       {/* Selected Check Mark */}
                       {isLongPressMode && selectedVideos.has(video.id) && (
                            <div className="absolute inset-0 flex items-center justify-center bg-accent/70 pointer-events-none">
                                <CheckCircle className="h-10 w-10 text-white" />
                            </div>
                       )}
                    </div>
                    <CardFooter className="p-2 bg-card/90 backdrop-blur-sm">
                      <div className="flex justify-between items-center w-full gap-2"> {/* Added gap */}
                        <p className="text-xs font-medium truncate flex-1" title={video.name}>{video.name}</p>
                         {/* More Options - only visible if not in selection mode */}
                         {!isLongPressMode && (
                           <DropdownMenu>
                             <DropdownMenuTrigger asChild>
                               <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                 <MoreVertical className="h-4 w-4" />
                                 <span className="sr-only">More options for {video.name}</span>
                               </Button>
                             </DropdownMenuTrigger>
                             <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                               <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleVideoClick(video.id); }}>
                                 <PlayIcon className="mr-2 h-4 w-4" /> Play
                               </DropdownMenuItem>
                               {/* Delete Confirmation within Dropdown */}
                               <Dialog>
                                  <DialogTrigger asChild>
                                      <DropdownMenuItem
                                          className="text-destructive focus:text-destructive focus:bg-destructive/10"
                                          onSelect={(e) => e.preventDefault()} // Prevent closing dropdown immediately
                                      >
                                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                                      </DropdownMenuItem>
                                  </DialogTrigger>
                                  <DialogContent onClick={(e) => e.stopPropagation()}>
                                      <DialogHeader>
                                          <DialogTitle>Confirm Deletion</DialogTitle>
                                          <DialogDescription>
                                              Are you sure you want to delete "{video.name}"? This action cannot be undone.
                                          </DialogDescription>
                                      </DialogHeader>
                                      <DialogFooter>
                                          <DialogClose asChild>
                                              <Button variant="outline">Cancel</Button>
                                          </DialogClose>
                                          <DialogClose asChild>
                                              {/* Set selection right before delete action */}
                                              <Button variant="destructive" onClick={() => {
                                                  setSelectedVideos(new Set([video.id]));
                                                  deleteSelectedVideos();
                                              }}>Delete</Button>
                                          </DialogClose>
                                      </DialogFooter>
                                  </DialogContent>
                               </Dialog>
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
