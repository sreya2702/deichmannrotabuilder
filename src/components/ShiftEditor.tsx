import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SECTIONS, type Section, type Shift } from "@/lib/types";
import { SHIFT_PRESETS, PRESET_LABELS, hoursBetween } from "@/lib/rota";

export interface ShiftEditorState {
  employeeId: string;
  employeeName: string;
  dayIdx: number;
  dayLabel: string;
  shift: Shift | null;
  section: Section | null;
}

interface Props {
  open: boolean;
  initial: ShiftEditorState | null;
  onClose: () => void;
  onSave: (next: { shift: Shift; section: Section }) => void;
  onRemove: () => void;
}

export function ShiftEditor({ open, initial, onClose, onSave, onRemove }: Props) {
  const [section, setSection] = useState<Section>("Tills");
  const [start, setStart] = useState("10:00");
  const [end, setEnd] = useState("18:00");

  useEffect(() => {
    if (initial) {
      setSection((initial.section as Section) ?? "Tills");
      setStart(initial.shift?.start ?? "10:00");
      setEnd(initial.shift?.end ?? "18:00");
    }
  }, [initial]);

  if (!initial) return null;

  const hours = hoursBetween(start, end);

  const applyPreset = (key: string) => {
    const p = SHIFT_PRESETS[key];
    if (!p) return;
    setStart(p.start);
    setEnd(p.end);
  };

  const save = () => {
    if (hours <= 0) return;
    onSave({
      shift: { start, end, hours },
      section,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Edit shift — {initial.employeeName} · {initial.dayLabel}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div>
            <Label className="text-xs text-muted-foreground">Section</Label>
            <Select value={section} onValueChange={(v) => setSection(v as Section)}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SECTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Quick preset</Label>
            <Select onValueChange={applyPreset}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Choose a preset…" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PRESET_LABELS).map(([k, label]) => (
                  <SelectItem key={k} value={k}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Start</Label>
              <Input
                type="time"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="mt-1 tabular"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">End</Label>
              <Input
                type="time"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="mt-1 tabular"
              />
            </div>
          </div>

          <div className="bg-surface border border-border rounded-md px-3 py-2 text-sm tabular">
            Duration: <span className="font-semibold">{hours}h</span>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {initial.shift ? (
            <Button variant="outline" onClick={onRemove} className="gap-2">
              <Trash2 className="size-4 text-destructive" />
              Remove shift
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={save} disabled={hours <= 0} className="bg-primary text-primary-foreground">
              Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
