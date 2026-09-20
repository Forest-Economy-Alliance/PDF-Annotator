import type { Annotation, Label } from '../../types';
import { hexToRgba } from '../../lib/color';

interface Props {
  annotations: Annotation[];
  labelsById: Map<string, Label>;
  activeAnnotationId: string | null;
  onSelect: (annotation: Annotation, rectEl: DOMRect) => void;
}

export function HighlightOverlay({ annotations, labelsById, activeAnnotationId, onSelect }: Props) {
  return (
    <div className="pointer-events-none absolute inset-0 z-[2]">
      {annotations.map((annotation) =>
        annotation.rects.map((rect, i) => {
          const colors = annotation.labelIds
            .map((id) => labelsById.get(id)?.color)
            .filter((c): c is string => Boolean(c));
          const bg = colors.length > 0 ? hexToRgba(colors[0], 0.32) : 'rgba(250, 204, 21, 0.35)';
          const isActive = annotation.id === activeAnnotationId;

          return (
            <div
              key={`${annotation.id}-${i}`}
              onClick={(e) => onSelect(annotation, (e.target as HTMLElement).getBoundingClientRect())}
              className="pointer-events-auto absolute cursor-pointer rounded-sm transition-[outline]"
              style={{
                left: `${rect.x * 100}%`,
                top: `${rect.y * 100}%`,
                width: `${rect.width * 100}%`,
                height: `${rect.height * 100}%`,
                backgroundColor: bg,
                outline: isActive ? '2px solid #2563eb' : 'none',
                outlineOffset: 1,
              }}
              title={annotation.labelIds.map((id) => labelsById.get(id)?.name).filter(Boolean).join(', ')}
            >
              {colors.length > 1 && (
                <div className="absolute inset-x-0 top-0 flex h-[3px] gap-px overflow-hidden">
                  {colors.map((c, ci) => (
                    <span key={ci} className="flex-1" style={{ backgroundColor: c }} />
                  ))}
                </div>
              )}
            </div>
          );
        }),
      )}
    </div>
  );
}
