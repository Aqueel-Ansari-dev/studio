'use client'

import React, { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button" 
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger} from "@/components/ui/dialog";
import { logAttendance, checkoutAttendance } from '@/app/actions/attendance';

type GeolocationPosition = {
  coords: {
    latitude: number;
    longitude: number;
  };
};

declare global {
  interface NavigatorGeolocation {
    getCurrentPosition(
      successCallback: (position: GeolocationPosition) => void,
      errorCallback?: (error: GeolocationPositionError) => void,
      options?: PositionOptions
    ): void;
  }

  interface Navigator extends NavigatorGeolocation {
    geolocation: NavigatorGeolocation;
  }
}

const AttendanceButton = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [projects, setProjects] = useState<string[]>([]); // Replace with actual project data type
  const [selectedProject, setSelectedProject] = useState<string | undefined>(undefined);
  const [isPunchedIn, setIsPunchedIn] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [location, setLocation] = useState<GeolocationPosition | null>(null);
  const [employeeId, setEmployeeId] = useState<string>(''); // Assuming you have a way to get the employee ID

  useEffect(() => {
    // Fetch projects from API here (replace with your actual API call)
    const fetchProjects = async () => {
      // const data = await fetch('/api/projects');
      // const projects = await data.json();
      setProjects(["Project A", "Project B", "Project C"]); // Example data
    };

    fetchProjects();

    const getVideo = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' }, // Use the front camera
          audio: false,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Error accessing camera: ", err);
      }
    };

    getVideo();

    // Get user location
    const getLocation = () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setLocation(position);
          },
          (error) => {
            console.error("Error getting location: ", error);
          }
        );
      } else {
        console.error("Geolocation is not supported by this browser.");
      }
    };

    getLocation();

    // Get employee ID (replace with your actual logic)
    // For example, from auth context or local storage
    setEmployeeId('employee123');

  }, []);

  const handlePunchIn = async () => {
    setIsOpen(true);
  };

  const handlePunchOut = async () => {
    capturePhoto();

    if (!location) {
      alert('Could not get location');
      return
    }

    if (!selectedProject) {
      alert('Please select a project');
      return;
    }

    if (!employeeId) {
      alert('Could not get Employee Id');
      return;
    }

    const result = await checkoutAttendance(
      employeeId,
      selectedProject,
      location.coords ? { lat: location.coords.latitude, lng: location.coords.longitude } : undefined,
      photo || undefined
    );

    if (result.success) {
      setIsPunchedIn(false);
      setPhoto(null);
    }

    alert(result.message)
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context?.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);

      const dataURL = canvas.toDataURL('image/png');
      setPhoto(dataURL);
    }
  };

  const handleSubmit = async () => {
    capturePhoto();

    if (!location) {
      alert('Could not get location');
      return
    }

    if (!selectedProject) {
      alert('Please select a project');
      return;
    }

    if (!employeeId) {
      alert('Could not get Employee Id');
      return;
    }

    const result = await logAttendance(
      employeeId,
      selectedProject,
      location.coords ? { lat: location.coords.latitude, lng: location.coords.longitude } : undefined,
      false,
      photo || undefined
    );

    if (result.success) {
      setIsPunchedIn(true);
    }

    setIsOpen(false);

    alert(result.message)
  };

  return (
    <div>
      <Button onClick={isPunchedIn ? handlePunchOut : handlePunchIn}>
        {isPunchedIn ? 'Punch Out' : 'Punch In'}
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          {/* Keep the button here, but hide it */}          
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">          
          <DialogHeader>
            <DialogTitle>Attendance</DialogTitle>
            <DialogDescription>
              {isPunchedIn ? 'Punch Out' : 'Punch In'}
            </DialogDescription>
          </DialogHeader>

          {/* Camera Preview (replace with actual camera component) */}
          <video ref={videoRef} autoPlay className="w-32 h-32 rounded-full object-cover" />
          <canvas ref={canvasRef} style={{ display: 'none' }} />
          {photo && <img src={photo} alt="Captured Selfie" className="w-32 h-32 rounded-full object-cover" />}

          <Select onValueChange={(value) => setSelectedProject(value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select a project" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((project) => (
                <SelectItem key={project} value={project}>{project}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button onClick={handleSubmit}>Submit</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AttendanceButton;
