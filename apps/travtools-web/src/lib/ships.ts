import { Annotation, Ship } from '../types';

export interface SchematicRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

export function annotationPosition(clientX: number, clientY: number, rect: SchematicRect): { x: number; y: number } {
  if (rect.width <= 0 || rect.height <= 0) return { x: 0, y: 0 };
  return {
    x: clampPercent(((clientX - rect.left) / rect.width) * 100),
    y: clampPercent(((clientY - rect.top) / rect.height) * 100),
  };
}

export function removeAnnotationById(annotations: Annotation[], annotationId: string): Annotation[] {
  return annotations.filter(annotation => annotation.id !== annotationId);
}

export function sortShips(ships: Ship[]): Ship[] {
  return [...ships].sort((a, b) => a.name.localeCompare(b.name));
}
