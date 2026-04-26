import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useStore, setEmployees } from "@/lib/store";
import { DAYS, type Employee, type Role } from "@/lib/types";

export const Route = createFileRoute("/employees")({
  component: EmployeesPage,
  head: () => ({ meta: [{ title: "Employees — Rota Cockpit" }] }),
});

const ROLES: Role[] = ["Manager", "Supervisor", "Full time", "Part time"];

function EmployeesPage() {
  const { employees } = useStore();
  const [draft, setDraft] = useState<Partial<Employee>>({
    name: "",
    role: "Full time",
    contractedHours: 40,
    hourlyRate: 12,
    availability: [true, true, true, true, true, true, true],
  });

  const update = (id: string, patch: Partial<Employee>) => {
    setEmployees(employees.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  };
  const remove = (id: string) => setEmployees(employees.filter((e) => e.id !== id));

  const add = () => {
    if (!draft.name) return;
    const e: Employee = {
      id: `e_${Date.now()}`,
      name: draft.name!,
      role: (draft.role as Role) ?? "Full time",
      contractedHours: Number(draft.contractedHours ?? 40),
      hourlyRate: Number(draft.hourlyRate ?? 12),
      availability: draft.availability ?? Array(7).fill(true),
    };
    setEmployees([...employees, e]);
    setDraft({
      name: "",
      role: "Full time",
      contractedHours: 40,
      hourlyRate: 12,
      availability: [true, true, true, true, true, true, true],
    });
  };

  return (
    <div className="p-6 flex flex-col gap-6 min-h-screen">
      <header className="bg-panel border border-border rounded-xl p-5 flex items-center gap-3">
        <div className="size-10 rounded-md bg-primary/15 ring-1 ring-primary/30 flex items-center justify-center">
          <Users className="size-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Employees</h1>
          <p className="text-sm text-muted-foreground">Manage roster, rates and weekly availability.</p>
        </div>
      </header>

      <div className="bg-panel border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border bg-surface text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="p-3">Name</th>
                <th className="p-3">Role</th>
                <th className="p-3 text-right">Contract h</th>
                <th className="p-3 text-right">Rate £/h</th>
                {DAYS.map((d) => (
                  <th key={d} className="p-3 text-center">{d}</th>
                ))}
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {employees.map((e) => (
                <tr key={e.id} className="hover:bg-white/[0.02]">
                  <td className="p-2">
                    <Input
                      value={e.name}
                      onChange={(ev) => update(e.id, { name: ev.target.value })}
                      className="bg-surface border-border"
                    />
                  </td>
                  <td className="p-2">
                    <Select value={e.role} onValueChange={(v) => update(e.id, { role: v as Role })}>
                      <SelectTrigger className="bg-surface border-border w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.map((r) => (
                          <SelectItem key={r} value={r}>{r}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-2">
                    <Input
                      type="number"
                      step="0.5"
                      value={e.contractedHours}
                      onChange={(ev) => update(e.id, { contractedHours: parseFloat(ev.target.value) || 0 })}
                      className="bg-surface border-border w-20 text-right tabular"
                    />
                  </td>
                  <td className="p-2">
                    <Input
                      type="number"
                      step="0.1"
                      value={e.hourlyRate}
                      onChange={(ev) => update(e.id, { hourlyRate: parseFloat(ev.target.value) || 0 })}
                      className="bg-surface border-border w-24 text-right tabular"
                    />
                  </td>
                  {e.availability.map((a, i) => (
                    <td key={i} className="p-2 text-center">
                      <Checkbox
                        checked={a}
                        onCheckedChange={(v) => {
                          const next = [...e.availability];
                          next[i] = !!v;
                          update(e.id, { availability: next });
                        }}
                      />
                    </td>
                  ))}
                  <td className="p-2 text-right">
                    <Button size="icon" variant="ghost" onClick={() => remove(e.id)}>
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add new */}
      <div className="bg-panel border border-border rounded-xl p-5">
        <h2 className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-4">Add Employee</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
          <div className="md:col-span-2">
            <label className="text-xs text-muted-foreground">Name</label>
            <Input
              value={draft.name ?? ""}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="e.g. Jamie Patel"
              className="bg-surface border-border mt-1"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Role</label>
            <Select value={draft.role} onValueChange={(v) => setDraft({ ...draft, role: v as Role })}>
              <SelectTrigger className="bg-surface border-border mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Contract h</label>
            <Input
              type="number"
              value={draft.contractedHours ?? 40}
              onChange={(e) => setDraft({ ...draft, contractedHours: parseFloat(e.target.value) })}
              className="bg-surface border-border mt-1 tabular"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Rate £/h</label>
            <Input
              type="number"
              value={draft.hourlyRate ?? 12}
              onChange={(e) => setDraft({ ...draft, hourlyRate: parseFloat(e.target.value) })}
              className="bg-surface border-border mt-1 tabular"
            />
          </div>
        </div>
        <Button onClick={add} className="mt-4 bg-primary text-primary-foreground">
          <Plus className="size-4" /> Add Employee
        </Button>
      </div>
    </div>
  );
}
