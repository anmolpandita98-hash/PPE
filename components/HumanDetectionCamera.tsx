'use client';

import { useEffect, useRef, useState } from 'react';

interface Detection {
  bbox: [number, number, number, number]; // [x, y, width, height]
  class: string;
  score: number;
  distance: number; // Estimated distance in meters
  type: 'human' | 'microphone' | 'other'; // Detection type
  violation?: 'no_safety_helmet' | 'phone_usage' | null; // Safety violations
  violationTimestamp?: number; // Timestamp when violation was first detected
  lastReportedTimestamp?: number; // Timestamp when violation was last reported
}

interface ViolationRecord {
  type: 'no_safety_helmet' | 'phone_usage';
  detectedAt: number; // Timestamp when first detected
  lastReportedAt: number; // Timestamp when last reported
  detectionId: string; // Unique identifier for this violation instance
}

interface ViolationLog {
  id: string;
  violationType: 'no_safety_helmet' | 'phone_usage';
  timestamp: Date;
  detection: Detection;
  count: number; // Number of times this violation was logged
}

export function HumanDetectionCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectionEnabled, setDetectionEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [videoReady, setVideoReady] = useState(false);
  const [violationLogs, setViolationLogs] = useState<ViolationLog[]>([]);
  const [violationRecords, setViolationRecords] = useState<Map<string, ViolationRecord>>(new Map());
  const modelRef = useRef<any>(null);
  const faceModelRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastLogTimeRef = useRef<Record<string, number>>({}); // Track last log time per violation
  const violationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  // Active violations: id -> { type, detectedAt, lastReportedAt, bbox } so we match by overlap, not position id
  const activeViolationsRef = useRef<Map<string, { type: 'no_safety_helmet' | 'phone_usage'; detectedAt: number; lastReportedAt: number; bbox: [number, number, number, number] }>>(new Map());
  
  // Cooldown period: 1 minute (60000 milliseconds)
  const VIOLATION_COOLDOWN_MS = 60000;

  // Check if two bboxes overlap significantly (same person/object)
  function bboxOverlapRatio(
    a: [number, number, number, number],
    b: [number, number, number, number]
  ): number {
    const [ax, ay, aw, ah] = a;
    const [bx, by, bw, bh] = b;
    const overlapX = Math.max(0, Math.min(ax + aw, bx + bw) - Math.max(ax, bx));
    const overlapY = Math.max(0, Math.min(ay + ah, by + bh) - Math.max(ay, by));
    const overlapArea = overlapX * overlapY;
    const areaA = aw * ah;
    const areaB = bw * bh;
    const minArea = Math.min(areaA, areaB);
    return minArea > 0 ? overlapArea / minArea : 0;
  }

  // Attach stream to video when both are ready
  useEffect(() => {
    if (streamRef.current && videoRef.current && !videoRef.current.srcObject) {
      console.log('Stream and video both ready, attaching...');
      const video = videoRef.current;
      video.srcObject = streamRef.current;
      video.play().catch(err => console.error('Video play error:', err));
    }
  }, [videoReady]);

  // Handle canvas resizing to match video display
  useEffect(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const container = containerRef.current;

    function updateCanvasSize() {
      if (!video || !canvas || !container) return;
      
      const videoRect = video.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      
      // Set canvas display size to match video display
      canvas.style.width = `${videoRect.width}px`;
      canvas.style.height = `${videoRect.height}px`;
      
      // Set canvas internal resolution to match video resolution
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }
    }

    const resizeObserver = new ResizeObserver(updateCanvasSize);
    if (container) {
      resizeObserver.observe(container);
    }

    video.addEventListener('loadedmetadata', updateCanvasSize);
    video.addEventListener('resize', updateCanvasSize);

    return () => {
      resizeObserver.disconnect();
      video.removeEventListener('loadedmetadata', updateCanvasSize);
      video.removeEventListener('resize', updateCanvasSize);
    };
  }, [isDetecting]);

  // Initialize camera and model
  useEffect(() => {
    let mounted = true;
    let checkReadyInterval: NodeJS.Timeout | null = null;

    async function init() {
      try {
        // Load COCO-SSD model dynamically
        setIsLoading(true);
        setError(null);
        
        console.log('Loading TensorFlow.js models...');
        await import('@tensorflow/tfjs');
        
        // Load COCO-SSD for person detection
        const cocoSsd = await import('@tensorflow-models/coco-ssd');
        const model = await cocoSsd.load();
        if (!mounted) return;
        modelRef.current = model;
        console.log('COCO-SSD model loaded successfully');
        
        // Load face detection model for better face/person detection
        try {
          const faceDetection = await import('@tensorflow-models/face-detection');
          const faceModel = await faceDetection.createDetector(
            faceDetection.SupportedModels.MediaPipeFaceDetector,
            {
              runtime: 'mediapipe',
              modelType: 'short',
              maxFaces: 10,
            }
          );
          if (!mounted) return;
          faceModelRef.current = faceModel;
          console.log('Face detection model loaded successfully');
        } catch (faceErr) {
          console.warn('Face detection model failed to load, continuing with person detection only:', faceErr);
          // Face detection is optional, continue without it
          faceModelRef.current = null;
        }

        // Check if mediaDevices is available
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Camera access not available. Please use HTTPS or localhost.');
        }

        // Access webcam - try with ideal constraints first, fallback to basic
        console.log('Requesting camera access...');
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { 
              width: { ideal: 1280 },
              height: { ideal: 720 }
            }
          });
        } catch (err) {
          // Fallback to basic video constraints if ideal fails
          console.log('Falling back to basic video constraints...');
          stream = await navigator.mediaDevices.getUserMedia({
            video: true
          });
        }
        
        if (!mounted) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        console.log('Camera stream obtained');
        streamRef.current = stream;
        
        // Wait for video element to be available (with retries)
        let retries = 0;
        const maxRetries = 100; // 10 seconds max wait
        while (!videoRef.current && retries < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 100));
          retries++;
          if (retries % 10 === 0) {
            console.log(`Waiting for video element... (${retries}/${maxRetries})`);
          }
        }

        if (!videoRef.current) {
          console.error('Video element not available after waiting');
          stream.getTracks().forEach(track => track.stop());
          throw new Error('Video element not found. The video element may not be rendered yet. Please refresh the page.');
        }

        const video = videoRef.current;
        console.log('Video element found, attaching stream...');
        
        // Ensure video element is ready
        if (video.readyState === 0) {
          // Video not loaded yet, wait a bit more
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        video.srcObject = stream;
        setVideoReady(true);

        // Wait for video metadata to load
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Video metadata loading timeout'));
          }, 10000);

          const onLoadedMetadata = () => {
            clearTimeout(timeout);
            video.removeEventListener('loadedmetadata', onLoadedMetadata);
            video.removeEventListener('error', onError);
            console.log('Video metadata loaded:', video.videoWidth, 'x', video.videoHeight);
            resolve();
          };

          const onError = (e: Event) => {
            clearTimeout(timeout);
            video.removeEventListener('loadedmetadata', onLoadedMetadata);
            video.removeEventListener('error', onError);
            reject(new Error('Video loading error'));
          };

          video.addEventListener('loadedmetadata', onLoadedMetadata);
          video.addEventListener('error', onError);
          
          // Try to play
          video.play().catch(err => {
            console.error('Video play error:', err);
            reject(err);
          });
        });

        if (!mounted) return;

        setIsLoading(false);
        setIsDetecting(true);
        console.log('Camera and models ready. Waiting for detection to be enabled...');
        
        // Don't auto-start detection - wait for user to click the button
      } catch (err: any) {
        console.error('Initialization error:', err);
        setError(err.message || 'Failed to initialize camera or model');
        setIsLoading(false);
        setIsDetecting(false);
      }
    }

    init();

    return () => {
      mounted = false;
      setIsDetecting(false);
      
      if (checkReadyInterval) {
        clearInterval(checkReadyInterval);
      }
      
      // Cleanup
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, []);

  // Estimate distance based on bounding box height
  // This is a simplified estimation - assumes average person height of 1.7m
  // Distance ≈ (focal_length * real_height) / pixel_height
  // Using a simplified formula: distance ≈ 1000 / (bbox_height / 10)
  function estimateDistance(bboxHeight: number, imageHeight: number): number {
    // Normalize height (0-1)
    const normalizedHeight = bboxHeight / imageHeight;
    
    // Simplified distance estimation
    // Closer objects appear larger, so inverse relationship
    // Assuming camera FOV and typical webcam parameters
    const estimatedDistance = Math.max(0.5, Math.min(10, 2.0 / normalizedHeight));
    
    return Math.round(estimatedDistance * 10) / 10; // Round to 1 decimal
  }

  // Generate unique ID for a detection based on its position and type
  function getDetectionId(detection: Detection): string {
    const [x, y, width, height] = detection.bbox;
    return `${detection.type}-${detection.violation}-${Math.round(x)}-${Math.round(y)}-${Math.round(width)}-${Math.round(height)}`;
  }

  // Log violations with timestamps (called every 10 seconds)
  function logViolations(detections: Detection[]) {
    if (!detectionEnabled) return;

    const now = Date.now();
    const violations = detections.filter(d => d.violation === 'no_safety_helmet' || d.violation === 'phone_usage');
    
    violations.forEach(detection => {
      if (!detection.violation) return;
      
      const detectionId = getDetectionId(detection);
      const lastLogTime = lastLogTimeRef.current[detectionId] || 0;
      const timeSinceLastLog = now - lastLogTime;
      
      // Log if it's been 1 minute (cooldown period) or more since last log, or if it's a new violation
      if (timeSinceLastLog >= VIOLATION_COOLDOWN_MS || lastLogTime === 0) {
        const violationLog: ViolationLog = {
          id: detectionId,
          violationType: detection.violation,
          timestamp: new Date(),
          detection: { ...detection },
          count: 1,
        };

        // Check if this violation already exists in logs
        setViolationLogs(prevLogs => {
          const existingIndex = prevLogs.findIndex(log => log.id === detectionId);
          
          if (existingIndex >= 0) {
            // Update existing log with new timestamp and increment count
            const updatedLogs = [...prevLogs];
            updatedLogs[existingIndex] = {
              ...updatedLogs[existingIndex],
              timestamp: new Date(),
              count: updatedLogs[existingIndex].count + 1,
              detection: { ...detection },
            };
            return updatedLogs;
          } else {
            // Add new violation log
            return [...prevLogs, violationLog];
          }
        });

        // Update last log time
        lastLogTimeRef.current[detectionId] = now;
        
        // Console log for debugging
        const violationName = detection.violation === 'no_safety_helmet' ? 'No Safety Helmet' : 'Phone Usage';
        console.log(`[${violationLog.timestamp.toLocaleTimeString()}] ${violationName} detected - Logged`);
      }
    });
  }

  async function detectHumans() {
    if (!videoRef.current || !canvasRef.current || !modelRef.current || !isDetecting) {
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const model = modelRef.current;

    // Check if video is ready and has dimensions
    if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
      // Video not ready yet, try again soon
      animationFrameRef.current = requestAnimationFrame(() => {
        detectHumans().catch(err => {
          console.error('Detection error:', err);
        });
      });
      return;
    }

    // Set canvas size to match video display size (not video element size)
    const videoRect = video.getBoundingClientRect();
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Scale canvas to match video display
    const scaleX = videoRect.width / video.videoWidth;
    const scaleY = videoRect.height / video.videoHeight;

    try {
      // Run detection with lower confidence threshold (0.3 instead of default 0.5)
      const predictions = await model.detect(video, undefined, 0.3);
      
      // Separate detections into humans and other objects (including potential microphones and phones)
      let humanDetections: Detection[] = [];
      let microphoneDetections: Detection[] = [];
      let otherDetections: Detection[] = [];
      
      // COCO-SSD classes that might indicate microphones (excluding phones)
      const microphoneLikeClasses = ['remote', 'mouse', 'keyboard'];
      
      predictions.forEach(pred => {
        const [x, y, width, height] = pred.bbox;
        const distance = estimateDistance(height, canvas.height);
        
        const detection: Detection = {
          bbox: [x, y, width, height] as [number, number, number, number],
          class: pred.class,
          score: pred.score,
          distance,
          type: 'other',
        };
        
        if (pred.class === 'person') {
          detection.type = 'human';
          // Check for safety helmet (simplified - in real implementation would use helmet detection model)
          // For now, we'll mark all as "no safety helmet" - you can enhance this with actual helmet detection
          detection.violation = 'no_safety_helmet';
          humanDetections.push(detection);
        } else if (pred.class === 'cell phone' || pred.class.toLowerCase().includes('phone')) {
          // Phones are rectangular (wider than tall) - aspect ratio > 1
          // Phones should be detected as "Phone usage detected"
          detection.type = 'microphone'; // Using microphone type but will change label
          detection.class = 'phone';
          detection.violation = 'phone_usage';
          microphoneDetections.push(detection);
        } else {
          // Check object characteristics to distinguish phones from microphones
          const aspectRatio = width / height;
          const area = width * height;
          
          // PHONES: Rectangular, wider than tall (aspect ratio > 1.0, typically 1.2-2.5)
          // MICROPHONES: Cylindrical, taller than wide (aspect ratio < 1.2, typically 0.4-1.0)
          
          const isRectangular = aspectRatio > 1.1; // Wider than tall (phone-like)
          const isCylindrical = aspectRatio < 1.1 && aspectRatio > 0.4; // Taller than wide (microphone-like)
          const isMediumSized = area > 300 && area < 80000;
          
          if (isRectangular && isMediumSized) {
            // This is likely a phone (rectangular shape)
            const centerY = y + height / 2;
            const centerX = x + width / 2;
            
            // Check if it's being held by a person (phones are often in upper-middle area, near hands)
            const isInPhoneZone = centerY > canvas.height * 0.2 && centerY < canvas.height * 0.8 &&
                                  centerX > canvas.width * 0.1 && centerX < canvas.width * 0.9;
            
            // Check if it's near a detected person (phones are usually held by people)
            const isNearPerson = humanDetections.some(human => {
              const [hX, hY, hW, hH] = human.bbox;
              const humanCenterX = hX + hW / 2;
              const humanCenterY = hY + hH / 2;
              const distanceX = Math.abs(centerX - humanCenterX);
              const distanceY = Math.abs(centerY - humanCenterY);
              // Check if phone is near person's upper body/hands area
              return distanceX < hW * 1.2 && 
                     centerY > hY && centerY < hY + hH * 0.7; // Upper 70% of person
            });
            
            if (isInPhoneZone || isNearPerson) {
              detection.type = 'microphone'; // Using microphone type but will display as phone
              detection.class = 'phone';
              detection.violation = 'phone_usage';
              microphoneDetections.push(detection);
            } else {
              otherDetections.push(detection);
            }
          } else if (isCylindrical && isMediumSized) {
            // This is likely a microphone (cylindrical shape)
            const centerY = y + height / 2;
            const centerX = x + width / 2;
            
            // Check if it's in a reasonable position (lower-middle area where microphones often are)
            const isInMicrophoneZone = centerY > canvas.height * 0.3 && centerY < canvas.height * 0.95 &&
                                       centerX > canvas.width * 0.15 && centerX < canvas.width * 0.85;
            
            // Also check if it's near a detected person (microphones are usually in front of people)
            const isNearPerson = humanDetections.some(human => {
              const [hX, hY, hW, hH] = human.bbox;
              const humanCenterX = hX + hW / 2;
              const humanCenterY = hY + hH / 2;
              const distanceX = Math.abs(centerX - humanCenterX);
              const distanceY = Math.abs(centerY - humanCenterY);
              // Check if microphone is within reasonable distance of person (horizontally aligned, vertically below)
              return distanceX < hW * 0.8 && centerY > hY && centerY < hY + hH * 1.5;
            });
            
            if (isInMicrophoneZone || isNearPerson) {
              detection.type = 'microphone';
              detection.class = 'microphone';
              microphoneDetections.push(detection);
            } else {
              otherDetections.push(detection);
            }
          } else {
            otherDetections.push(detection);
          }
        }
      });

      // Also run face detection to catch people that might be missed (especially with sunglasses, turbans, etc.)
      if (faceModelRef.current) {
        try {
          const faceDetections = await faceModelRef.current.estimateFaces(video);

          // Convert face detections to person-like detections
          // Faces indicate humans, so we add them as detections
          faceDetections.forEach((face: any) => {
            if (face.box && face.box.xMin !== undefined) {
              const x = face.box.xMin;
              const y = face.box.yMin;
              const width = face.box.width;
              const height = face.box.height;
              
              // Expand bounding box to approximate full person (face is typically ~1/7 to 1/8 of person height)
              // Use a conservative expansion to avoid false positives
              const expandedHeight = height * 6.5;
              const expandedY = Math.max(0, y - (expandedHeight - height) * 0.8);
              const expandedWidth = width * 2.2; // Approximate person width
              const expandedX = Math.max(0, x - (expandedWidth - width) / 2);
              
              // Ensure expanded box doesn't exceed canvas bounds
              const finalX = Math.min(expandedX, canvas.width - expandedWidth);
              const finalY = Math.max(0, expandedY);
              const finalWidth = Math.min(expandedWidth, canvas.width - finalX);
              const finalHeight = Math.min(expandedHeight, canvas.height - finalY);
              
              // Check if this face is already covered by a person detection
              const isCovered = humanDetections.some(det => {
                const [detX, detY, detW, detH] = det.bbox;
                // Calculate center points
                const faceCenterX = x + width / 2;
                const faceCenterY = y + height / 2;
                const detCenterX = detX + detW / 2;
                const detCenterY = detY + detH / 2;
                
                // Check if face center is within person detection box
                const isInside = faceCenterX >= detX && faceCenterX <= detX + detW &&
                                faceCenterY >= detY && faceCenterY <= detY + detH;
                
                // Also check overlap
                const overlapX = Math.max(0, Math.min(x + width, detX + detW) - Math.max(x, detX));
                const overlapY = Math.max(0, Math.min(y + height, detY + detH) - Math.max(y, detY));
                const overlapArea = overlapX * overlapY;
                const faceArea = width * height;
                const overlapRatio = overlapArea / faceArea;
                
                return isInside || overlapRatio > 0.4; // If face center is inside or 40% overlaps
              });

              // Add face-based detection if not covered (even with low confidence, faces are strong indicators)
              if (!isCovered) {
                const distance = estimateDistance(finalHeight, canvas.height);
                humanDetections.push({
                  bbox: [finalX, finalY, finalWidth, finalHeight] as [number, number, number, number],
                  class: 'person',
                  score: 0.6, // Give face detections a moderate confidence since they indicate humans
                  distance,
                  type: 'human',
                  violation: 'no_safety_helmet', // Mark as no safety helmet
                });
              }
            }
          });
        } catch (faceErr) {
          console.warn('Face detection error:', faceErr);
        }
      }

      // Combine all detections
      const allDetections = [...humanDetections, ...microphoneDetections];
      
      // Remove duplicate detections (if bounding boxes overlap significantly)
      const uniqueDetections: Detection[] = [];
      allDetections.forEach(det => {
        const [x, y, width, height] = det.bbox;
        const area = width * height;
        
        const isDuplicate = uniqueDetections.some(existing => {
          const [ex, ey, ew, eh] = existing.bbox;
          const exArea = ew * eh;
          
          // Calculate overlap
          const overlapX = Math.max(0, Math.min(x + width, ex + ew) - Math.max(x, ex));
          const overlapY = Math.max(0, Math.min(y + height, ey + eh) - Math.max(y, ey));
          const overlapArea = overlapX * overlapY;
          const unionArea = area + exArea - overlapArea;
          const iou = overlapArea / unionArea;
          
          // If IOU > 0.5, consider it a duplicate, keep the one with higher confidence
          if (iou > 0.5) {
            if (det.score > existing.score) {
              const index = uniqueDetections.indexOf(existing);
              uniqueDetections[index] = det;
            }
            return true;
          }
          return false;
        });
        
        if (!isDuplicate) {
          uniqueDetections.push(det);
        }
      });

      // Process violations: clock only once per person; match by bbox overlap so movement doesn't re-clock
      const now = Date.now();
      const activeViolations = activeViolationsRef.current;
      const OVERLAP_THRESHOLD = 0.2; // Same person if bboxes overlap by at least 20% of smaller box

      const processedDetections = uniqueDetections.map(detection => {
        if (detection.violation) {
          const bbox = detection.bbox;
          const [x, y, width, height] = bbox;

          // Find if this detection overlaps with any already-active violation of same type
          let matchedId: string | null = null;
          for (const [vid, data] of activeViolations.entries()) {
            if (data.type !== detection.violation) continue;
            const overlap = bboxOverlapRatio(bbox, data.bbox);
            if (overlap >= OVERLAP_THRESHOLD) {
              matchedId = vid;
              break;
            }
          }

          if (matchedId !== null) {
            // Same person still in frame - reuse timestamp, never re-clock
            const data = activeViolations.get(matchedId)!;
            detection.violationTimestamp = data.detectedAt;
            detection.lastReportedTimestamp = data.lastReportedAt;
            // Update stored bbox so we keep matching as they move
            activeViolations.set(matchedId, { ...data, bbox });
          } else {
            // New violation (person just entered frame) - clock once
            const violationId = `${detection.violation}_${now}_${Math.round(x)}_${Math.round(y)}`;
            detection.violationTimestamp = now;
            detection.lastReportedTimestamp = now;

            activeViolations.set(violationId, {
              type: detection.violation,
              detectedAt: now,
              lastReportedAt: now,
              bbox,
            });

            setViolationRecords(prev => {
              const updated = new Map(prev);
              updated.set(violationId, {
                type: detection.violation,
                detectedAt: now,
                lastReportedAt: now,
                detectionId: violationId,
              });
              return updated;
            });

            console.log(`Violation clocked once: ${detection.violation} at ${new Date(now).toLocaleTimeString()}`);
          }
        }
        return detection;
      });

      // Remove active violations that have no overlapping detection this frame (person left)
      const currentBoxes = processedDetections
        .filter(d => d.violation)
        .map(d => ({ type: d.violation!, bbox: d.bbox }));
      const toRemove: string[] = [];
      activeViolations.forEach((data, violationId) => {
        const stillInFrame = currentBoxes.some(
          c => c.type === data.type && bboxOverlapRatio(data.bbox, c.bbox) >= OVERLAP_THRESHOLD
        );
        if (!stillInFrame) toRemove.push(violationId);
      });
      toRemove.forEach(violationId => {
        activeViolations.delete(violationId);
        console.log(`Violation cleared (person left frame): ${violationId}`);
      });
      
      setDetections(processedDetections);
      
      // Log violations - only log when first detected (not continuously)
      if (detectionEnabled) {
        // Only log violations that were just clocked (newly detected)
        const violationsToLog = processedDetections.filter(d => {
          if (d.violation && d.violationTimestamp) {
            // Only log if this violation was just clocked (within last second)
            const timeSinceClock = now - d.violationTimestamp;
            return timeSinceClock < 1000; // Only log if clocked within last second
          }
          return false;
        });
        if (violationsToLog.length > 0) {
          logViolations(violationsToLog);
        }
      }

      // Draw on canvas
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw detections matching the reference style: red boxes for humans, labels below
      // Only show violations that are not in cooldown
      const currentTime = Date.now();
      processedDetections.forEach((detection) => {
        const [x, y, width, height] = detection.bbox;
        const confidence = Math.round(detection.score * 100);

        // All human detections use red boxes (matching reference style)
        let boxColor = '#ef4444'; // Red for humans (matching reference)
        let labelText = '';
        let labelBgColor = '#4b5563'; // Gray background (matching reference)
        let labelBorderColor = '#ef4444'; // Red border (matching reference)
        let labelTextColor = '#ffffff'; // White text (matching reference)
        
        if (detection.type === 'microphone') {
          // Check if it's actually a phone or microphone
          if (detection.class === 'phone' || detection.violation === 'phone_usage') {
            boxColor = '#ef4444'; // Red for phones (matching reference)
            // Always show label if violation is active (person in frame)
            if (detection.violation === 'phone_usage') {
              labelText = 'Phone usage detected';
            }
          } else {
            boxColor = '#3b82f6'; // Blue for actual microphones
            labelText = 'Microphone';
          }
        } else if (detection.type === 'human') {
          // Determine label based on violations
          if (detection.violation === 'no_safety_helmet') {
            // Always show label if violation is active (person in frame)
            labelText = 'No safety helmet';
          } else {
            labelText = 'Human detected';
          }
        }

        // Draw red rectangle (matching reference style - thicker line)
        ctx.strokeStyle = boxColor;
        ctx.lineWidth = 4; // Thicker line like reference
        ctx.strokeRect(x, y, width, height);

        // Draw label below the box (matching reference style)
        if (labelText) {
          ctx.font = 'bold 14px Arial'; // Bold font like reference
          const textMetrics = ctx.measureText(labelText);
          const labelPadding = 8;
          const labelHeight = 28;
          const labelWidth = textMetrics.width + labelPadding * 2;
          const labelX = x;
          const labelY = y + height + 2; // Position below the box

          // Draw gray background with red border (matching reference)
          ctx.fillStyle = labelBgColor;
          ctx.fillRect(labelX, labelY, labelWidth, labelHeight);
          
          // Draw red border
          ctx.strokeStyle = labelBorderColor;
          ctx.lineWidth = 2;
          ctx.strokeRect(labelX, labelY, labelWidth, labelHeight);

          // Draw white text
          ctx.fillStyle = labelTextColor;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          ctx.fillText(labelText, labelX + labelPadding, labelY + 6);
        }
      });
    } catch (err) {
      console.error('Detection error:', err);
    }

    // Continue detection loop only if detection is enabled
    if (isDetecting && detectionEnabled) {
      animationFrameRef.current = requestAnimationFrame(() => {
        detectHumans().catch(err => {
          console.error('Detection error:', err);
        });
      });
    }
  }

  function startDetection() {
    if (!videoRef.current || !isDetecting || !detectionEnabled) return;
    
    const video = videoRef.current;
    
    // Check if video is ready
    if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
      console.log('Video ready, starting detection loop');
      detectHumans().catch(err => {
        console.error('Detection error:', err);
      });
    } else {
      // Wait for video to be ready
      console.log('Waiting for video to be ready...');
      const checkReady = setInterval(() => {
        if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
          clearInterval(checkReady);
          console.log('Video ready, starting detection loop');
          detectHumans().catch(err => {
            console.error('Detection error:', err);
          });
        }
      }, 100);
      
      // Timeout after 10 seconds
      setTimeout(() => {
        clearInterval(checkReady);
      }, 10000);
    }
  }

  // Handle detection toggle button click
  function handleToggleDetection() {
    if (!isDetecting) return; // Can't enable if camera/model not ready
    
    setDetectionEnabled(prev => {
      const newState = !prev;
      if (newState) {
        console.log('Detection enabled - starting identification');
        // Clear previous detections
        setDetections([]);
        // Start detection
        setTimeout(() => {
          startDetection();
        }, 100);
      } else {
        console.log('Detection disabled');
        // Stop detection loop
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
        // Clear detections and reset violation tracking
        setDetections([]);
        lastLogTimeRef.current = {};
        activeViolationsRef.current.clear(); // So next Start doesn't think same person is still active
        // Keep violation logs for review (don't clear them)
      }
      return newState;
    });
  }

  // Auto-start detection when enabled changes
  useEffect(() => {
    if (detectionEnabled && isDetecting) {
      startDetection();
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    }
  }, [detectionEnabled, isDetecting]);

  // Set up 10-second interval for re-logging violations
  useEffect(() => {
    if (detectionEnabled && isDetecting) {
      // Set up interval to re-log violations every 10 seconds
      violationIntervalRef.current = setInterval(() => {
        // Access current detections via a ref or state getter
        setDetections(currentDetections => {
          if (currentDetections.length > 0 && detectionEnabled) {
            logViolations(currentDetections);
          }
          return currentDetections; // Return unchanged to avoid re-render
        });
      }, 10000); // 10 seconds
      
      return () => {
        if (violationIntervalRef.current) {
          clearInterval(violationIntervalRef.current);
          violationIntervalRef.current = null;
        }
      };
    } else {
      // Clean up interval when detection is disabled
      if (violationIntervalRef.current) {
        clearInterval(violationIntervalRef.current);
        violationIntervalRef.current = null;
      }
    }
  }, [detectionEnabled, isDetecting]);

  return (
    <div className="w-full max-w-6xl mx-auto p-6">
      <div className="bg-card rounded-xl border border-slate-700 p-6">
        <h2 className="text-xl font-semibold text-white mb-4">
          Human Detection Camera
        </h2>

        {error && (
          <div className="mb-4 p-4 bg-red-900/20 border border-red-500 rounded-lg text-red-300">
            Error: {error}
          </div>
        )}

        {isLoading && (
          <div className="flex items-center justify-center h-96 text-slate-400">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto mb-4"></div>
              <p>Loading camera and AI model...</p>
            </div>
          </div>
        )}

        {/* Always render video element, just hide it visually during loading */}
        <div 
          ref={containerRef}
          className="relative w-full bg-black rounded-lg overflow-hidden"
          style={{ 
            aspectRatio: '16/9', 
            minHeight: '400px',
            visibility: isLoading || error ? 'hidden' : 'visible'
          }}
        >
          {/* Top-left: Live AI Detection Status Panel with Button (matching reference) */}
          {isDetecting && (
            <>
              <div className="absolute top-4 left-4 z-10 bg-gray-800 px-4 py-2 rounded-lg border border-gray-700 flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${detectionEnabled ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}></div>
                <span className="text-white text-sm font-medium">Live AI Detection</span>
                <button
                  onClick={handleToggleDetection}
                  className={`ml-2 px-3 py-1 rounded text-xs font-medium transition-colors ${
                    detectionEnabled
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-green-600 hover:bg-green-700 text-white'
                  }`}
                  title={detectionEnabled ? 'Stop Detection' : 'Start Detection'}
                >
                  {detectionEnabled ? 'Stop' : 'Start'}
                </button>
              </div>
              
              {/* Violation Alert Panel (matching reference - grey border, red text) */}
              {detectionEnabled && detections.some(d => 
                d.type === 'human' && d.violation === 'no_safety_helmet'
              ) && (
                <div className="absolute top-16 left-4 z-10 bg-gray-800 px-4 py-2 rounded-lg border-2 border-red-600">
                  <span className="text-red-600 text-sm font-semibold">No safety helmet</span>
                </div>
              )}
            </>
          )}

          {/* Bottom-left: Behavior Detection Panel (matching reference) */}
          {detectionEnabled && isDetecting && (
            <>
              {/* Safety Compliance Panel - show active violations */}
              {detections.some(d => d.type === 'human' && d.violation === 'no_safety_helmet') && (
                <div className="absolute bottom-4 left-4 z-10 bg-white rounded-lg shadow-lg p-4 min-w-[200px]">
                  <div className="text-red-600 font-bold text-lg mb-2">Safety Compliance</div>
                  {detections
                    .filter(d => d.type === 'human' && d.violation === 'no_safety_helmet')
                    .map((detection, idx) => (
                      <div key={idx} className="text-red-600 text-sm">
                        No safety helmet
                        {detection.violationTimestamp && (
                          <span className="text-xs text-gray-500 ml-2">
                            ({new Date(detection.violationTimestamp).toLocaleTimeString()})
                          </span>
                        )}
                      </div>
                    ))}
                </div>
              )}
              
              {/* Behavior Detection Panel (for phone usage) - show active violations */}
              {detections.some(d => d.violation === 'phone_usage') && (
                <div className="absolute bottom-4 left-4 z-10 bg-white rounded-lg shadow-lg p-4 min-w-[200px]">
                  <div className="text-red-600 font-bold text-lg mb-2">Behavior Detection</div>
                  {detections
                    .filter(d => d.violation === 'phone_usage')
                    .map((detection, idx) => (
                      <div key={idx} className="text-black text-sm">
                        Phone usage detected
                        {detection.violationTimestamp && (
                          <span className="text-xs text-gray-500 ml-2">
                            ({new Date(detection.violationTimestamp).toLocaleTimeString()})
                          </span>
                        )}
                      </div>
                    ))}
                </div>
              )}
            </>
          )}

          <video
            ref={(el) => {
              videoRef.current = el;
              if (el && streamRef.current && !el.srcObject) {
                // If stream is ready but video doesn't have it yet, attach it
                console.log('Video ref callback: attaching stream');
                el.srcObject = streamRef.current;
                el.play().catch(err => console.error('Video play error in ref callback:', err));
              }
            }}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-contain"
            style={{ display: 'block' }}
            onLoadedMetadata={() => {
              console.log('Video metadata loaded via onLoadedMetadata event');
              setVideoReady(true);
            }}
          />
          <canvas
            ref={canvasRef}
            className="absolute top-0 left-0 pointer-events-none"
            style={{ 
              display: 'block',
              width: '100%',
              height: '100%',
              objectFit: 'contain'
            }}
          />
        </div>

        {/* Violation Logs Panel */}
        {detectionEnabled && violationLogs.length > 0 && (
          <div className="mt-4 p-4 bg-slate-800/50 rounded-lg">
            <h3 className="text-lg font-semibold text-white mb-3">Violation Logs</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {violationLogs
                .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()) // Most recent first
                .map((log) => (
                  <div
                    key={log.id}
                    className="p-3 bg-slate-700/50 rounded border-l-4 border-red-500"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-white font-medium">
                        {log.violationType === 'no_safety_helmet' ? '🚨 No Safety Helmet' : '📱 Phone Usage'}
                      </span>
                      <span className="text-slate-400 text-xs">
                        Count: {log.count}
                      </span>
                    </div>
                    <div className="text-slate-300 text-sm">
                      {log.timestamp.toLocaleString()}
                    </div>
                    <div className="text-slate-400 text-xs mt-1">
                      Confidence: {Math.round(log.detection.score * 100)}% | Distance: {log.detection.distance}m
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {isDetecting && (
          <div className="mt-4 p-4 bg-slate-800/50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-2 h-2 rounded-full ${detectionEnabled ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}></div>
              <p className="text-sm text-slate-300">
                Camera active - {detectionEnabled ? 'Detection running' : 'Click Start to begin detection'}
              </p>
            </div>
            {detections.length > 0 ? (
              <>
                {(() => {
                  const humans = detections.filter(d => d.type === 'human');
                  const microphones = detections.filter(d => d.type === 'microphone');
                  return (
                    <>
                      <p className="text-sm text-slate-300 mb-2">
                        Detected {humans.length} human{humans.length !== 1 ? 's' : ''} 
                        {microphones.length > 0 && ` and ${microphones.length} microphone${microphones.length !== 1 ? 's' : ''}`}
                      </p>
                      <div className="space-y-2">
                        {detections.map((detection, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between text-sm"
                          >
                            <span className={`${
                              detection.type === 'microphone' ? 'text-blue-400' : 'text-slate-400'
                            }`}>
                              {detection.type === 'microphone' ? '🎤' : '👤'} {detection.type === 'microphone' ? 'Microphone' : 'Person'} {idx + 1}
                            </span>
                            <div className="flex gap-4">
                              <span className="text-slate-300">
                                Confidence: <span className="font-semibold text-white">{Math.round(detection.score * 100)}%</span>
                              </span>
                              <span className="text-slate-300">
                                Distance: <span className="font-semibold text-white">{detection.distance}m</span>
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  );
                })()}
              </>
            ) : (
              <p className="text-sm text-slate-400">
                No detections. Make sure you're visible in front of the camera.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
