"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { ArrowRight, Link as LinkIcon, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface TimelineItem {
  id: number;
  title: string;
  date: string;
  content: string;
  category: string;
  icon: React.ElementType;
  relatedIds: number[];
  status: "completed" | "in-progress" | "pending";
  energy: number;
}

interface RadialOrbitalTimelineProps {
  timelineData: TimelineItem[];
  className?: string;
}

export default function RadialOrbitalTimeline({
  timelineData,
  className,
}: RadialOrbitalTimelineProps) {
  const [expandedItems, setExpandedItems] = useState<Record<number, boolean>>(
    {}
  );
  const [viewMode] = useState<"orbital">("orbital");
  const [rotationAngle, setRotationAngle] = useState<number>(0);
  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  const [pulseEffect, setPulseEffect] = useState<Record<number, boolean>>({});
  const [centerOffset] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const [activeNodeId, setActiveNodeId] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const orbitRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const animationFrameRef = useRef<number | null>(null);
  const lastUpdateTime = useRef<number>(0);

  const handleContainerClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === containerRef.current || e.target === orbitRef.current) {
      setExpandedItems({});
      setActiveNodeId(null);
      setPulseEffect({});
      setAutoRotate(true);
    }
  }, []);

  // Memoize related items lookup - must be defined before toggleItem
  const relatedItemsMap = useMemo(() => {
    const map = new Map<number, number[]>();
    timelineData.forEach((item) => {
      map.set(item.id, item.relatedIds);
    });
    return map;
  }, [timelineData]);

  const getRelatedItems = useCallback((itemId: number): number[] => {
    return relatedItemsMap.get(itemId) || [];
  }, [relatedItemsMap]);

  const isRelatedToActive = useCallback((itemId: number): boolean => {
    if (!activeNodeId) return false;
    const relatedItems = relatedItemsMap.get(activeNodeId) || [];
    return relatedItems.includes(itemId);
  }, [activeNodeId, relatedItemsMap]);

  const centerViewOnNode = useCallback((nodeId: number) => {
    if (viewMode !== "orbital" || !nodeRefs.current[nodeId]) return;

    const nodeIndex = timelineData.findIndex((item) => item.id === nodeId);
    const totalNodes = timelineData.length;
    const targetAngle = (nodeIndex / totalNodes) * 360;

    setRotationAngle(270 - targetAngle);
  }, [viewMode, timelineData]);

  const toggleItem = useCallback((id: number) => {
    setExpandedItems((prev) => {
      const newState = { ...prev };
      Object.keys(newState).forEach((key) => {
        if (parseInt(key) !== id) {
          newState[parseInt(key)] = false;
        }
      });

      newState[id] = !prev[id];

      if (!prev[id]) {
        setActiveNodeId(id);
        setAutoRotate(false);

        const relatedItems = getRelatedItems(id);
        const newPulseEffect: Record<number, boolean> = {};
        relatedItems.forEach((relId) => {
          newPulseEffect[relId] = true;
        });
        setPulseEffect(newPulseEffect);

        centerViewOnNode(id);
      } else {
        setActiveNodeId(null);
        setAutoRotate(true);
        setPulseEffect({});
      }

      return newState;
    });
  }, [getRelatedItems, centerViewOnNode]);

  // Optimized animation using requestAnimationFrame with batched updates
  const rotationAngleRef = useRef(rotationAngle);
  rotationAngleRef.current = rotationAngle;

  useEffect(() => {
    if (!autoRotate || viewMode !== "orbital") {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }

    let frameCount = 0;
    const animate = (currentTime: number) => {
      // Throttle to ~30fps (33ms per frame) for better performance
      if (currentTime - lastUpdateTime.current >= 33) {
        frameCount++;
        const newAngle = (rotationAngleRef.current + 0.15) % 360;
        rotationAngleRef.current = newAngle;
        
        // Only update React state every 5 frames to reduce re-renders
        if (frameCount % 5 === 0) {
          setRotationAngle(newAngle);
        }
        
        // Direct DOM manipulation for smooth animation without React re-renders
        if (orbitRef.current) {
          const nodes = orbitRef.current.querySelectorAll('[data-node-index]');
          if (nodes.length === timelineData.length) {
            const totalNodes = timelineData.length;
            nodes.forEach((node) => {
              const element = node as HTMLElement;
              const index = parseInt(element.getAttribute('data-node-index') || '0');
              const angle = ((index / totalNodes) * 360 + newAngle) % 360;
              const radian = (angle * Math.PI) / 180;
              const radius = 250;
              const x = radius * Math.cos(radian);
              const y = radius * Math.sin(radian);
              const opacity = Math.max(0.4, Math.min(1, 0.4 + 0.6 * ((1 + Math.sin(radian)) / 2)));
              
              // Use transform and opacity for GPU acceleration
              element.style.transform = `translate3d(${x}px, ${y}px, 0)`;
              element.style.opacity = String(opacity);
            });
          }
        }
        
        lastUpdateTime.current = currentTime;
      }
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [autoRotate, viewMode, timelineData.length]);

  // Memoize node positions calculation
  const nodePositions = useMemo(() => {
    return timelineData.map((_, index) => {
      const angle = ((index / timelineData.length) * 360 + rotationAngle) % 360;
      const radius = 250;
      const radian = (angle * Math.PI) / 180;

      const x = radius * Math.cos(radian) + centerOffset.x;
      const y = radius * Math.sin(radian) + centerOffset.y;
      const zIndex = Math.round(100 + 50 * Math.cos(radian));
      const opacity = Math.max(
        0.4,
        Math.min(1, 0.4 + 0.6 * ((1 + Math.sin(radian)) / 2))
      );

      return { x, y, angle, zIndex, opacity };
    });
  }, [timelineData.length, rotationAngle, centerOffset.x, centerOffset.y]);

  const getStatusStyles = (status: TimelineItem["status"]): string => {
    switch (status) {
      case "completed":
        return "text-white bg-black border-white";
      case "in-progress":
        return "text-black bg-white border-black";
      case "pending":
        return "text-white bg-black/40 border-white/50";
      default:
        return "text-white bg-black/40 border-white/50";
    }
  };

  return (
    <div
      className={`w-full min-h-[800px] h-[90vh] flex flex-col items-center justify-center bg-transparent overflow-hidden ${className || ''}`}
      ref={containerRef}
      onClick={handleContainerClick}
    >
      <div className="relative w-full max-w-4xl h-full flex items-center justify-center">
        <div
          className="absolute w-full h-full flex items-center justify-center"
          ref={orbitRef}
          style={{
            perspective: "1000px",
            transform: `translate(${centerOffset.x}px, ${centerOffset.y}px)`,
          }}
        >
          <div className="absolute w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 via-blue-500 to-teal-500 flex items-center justify-center z-10">
            <div className="w-12 h-12 rounded-full bg-white/80 backdrop-blur-md"></div>
          </div>

          <div className="absolute w-[500px] h-[500px] rounded-full border border-white/10"></div>

          {timelineData.map((item, index) => {
            const position = nodePositions[index];
            const isExpanded = expandedItems[item.id];
            const isRelated = isRelatedToActive(item.id);
            const isPulsing = pulseEffect[item.id];
            const Icon = item.icon;

            // Only use initial position from memoized calculation
            // Animation updates will be handled by direct DOM manipulation
            const nodeStyle = {
              transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
              zIndex: isExpanded ? 200 : position.zIndex,
              opacity: isExpanded ? 1 : position.opacity,
              willChange: autoRotate ? 'transform, opacity' : 'auto',
            };

            return (
              <div
                key={item.id}
                data-node-index={index}
                ref={(el) => (nodeRefs.current[item.id] = el)}
                className="absolute cursor-pointer"
                style={{
                  ...nodeStyle,
                  transition: isExpanded ? 'transform 0.3s ease-out, opacity 0.3s ease-out' : 'none',
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleItem(item.id);
                }}
              >
                {isPulsing && (
                  <div
                    className="absolute rounded-full -inset-1"
                    style={{
                      background: `radial-gradient(circle, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 70%)`,
                      width: `${item.energy * 0.5 + 80}px`,
                      height: `${item.energy * 0.5 + 80}px`,
                      left: `-${(item.energy * 0.5 + 80 - 80) / 2}px`,
                      top: `-${(item.energy * 0.5 + 80 - 80) / 2}px`,
                      animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                    }}
                  ></div>
                )}

                <div
                  className={`
                  w-20 h-20 rounded-full flex items-center justify-center
                  ${
                    isExpanded
                      ? "bg-white text-black"
                      : isRelated
                      ? "bg-white/50 text-black"
                      : "bg-white/20 backdrop-blur-sm text-white"
                  }
                  border-2 
                  ${
                    isExpanded
                      ? "border-white shadow-lg shadow-white/30"
                      : isRelated
                      ? "border-white"
                      : "border-white/40"
                  }
                  ${isExpanded ? "scale-150" : ""}
                  transition-transform duration-300 ease-out
                `}
                >
                  <Icon size={36} />
                </div>

                <div
                  className={`
                  absolute top-20 whitespace-nowrap
                  text-base font-semibold tracking-wider
                  ${isExpanded ? "text-white scale-125" : "text-white/70"}
                  transition-transform duration-300 ease-out
                `}
                >
                  {item.title}
                </div>

                {isExpanded && (
                  <Card className="absolute top-28 left-1/2 -translate-x-1/2 w-72 bg-white/10 backdrop-blur-lg border-white/30 shadow-xl shadow-white/10 overflow-visible">
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-px h-3 bg-white/50"></div>
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-center">
                        <Badge
                          className={`px-3 py-1 text-sm ${getStatusStyles(
                            item.status
                          )}`}
                        >
                          {item.status === "completed"
                            ? "COMPLETE"
                            : item.status === "in-progress"
                            ? "IN PROGRESS"
                            : "PENDING"}
                        </Badge>
                        <span className="text-sm font-mono text-white/50">
                          {item.date}
                        </span>
                      </div>
                      <CardTitle className="text-base mt-2 text-white">
                        {item.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-white/90">
                      <p>{item.content}</p>

                      <div className="mt-4 pt-3 border-t border-white/10">
                        <div className="flex justify-between items-center text-sm mb-2">
                          <span className="flex items-center text-white/80">
                            <Zap size={12} className="mr-1.5" />
                            Energy Level
                          </span>
                          <span className="font-mono text-white text-sm">{item.energy}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
                            style={{ width: `${item.energy}%` }}
                          ></div>
                        </div>
                      </div>

                      {item.relatedIds.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-white/10">
                          <div className="flex items-center mb-2">
                            <LinkIcon size={12} className="text-white/80 mr-1.5" />
                            <h4 className="text-sm uppercase tracking-wider font-medium text-white/80">
                              Connected Features
                            </h4>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {item.relatedIds.map((relatedId) => {
                              const relatedItem = timelineData.find(
                                (i) => i.id === relatedId
                              );
                              return (
                                <Button
                                  key={relatedId}
                                  variant="outline"
                                  size="sm"
                                  className="flex items-center h-7 px-3 py-0 text-sm rounded-none border-white/20 bg-transparent hover:bg-white/10 text-white/90 hover:text-white transition-all"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleItem(relatedId);
                                  }}
                                >
                                  {relatedItem?.title}
                                  <ArrowRight
                                    size={10}
                                    className="ml-1.5 text-white/70"
                                  />
                                </Button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

