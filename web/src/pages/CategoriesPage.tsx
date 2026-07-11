import { Plus, Pencil, Trash2, CornerDownRight } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { FullPageSpinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { useCategories, useCategoryMutations } from "@/hooks/queries";
import { apiErrorMessage } from "@/lib/api";
import type { Category, FlowType } from "@/types";

export function CategoriesPage() {
  const { data: categories, isLoading } = useCategories();
  const { create, update, remove } = useCategoryMutations();
  const { toast } = useToast();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState<FlowType>("expense");
  const [parentId, setParentId] = useState<string>("");
  const [toDelete, setToDelete] = useState<Category | null>(null);

  const parents = categories?.filter((c) => !c.parentCategoryId) ?? [];
  const income = parents.filter((c) => c.type === "income");
  const expense = parents.filter((c) => c.type === "expense");

  function openCreate(presetType?: FlowType, presetParent?: Category) {
    setEditing(null);
    setName("");
    setType(presetParent ? presetParent.type : presetType ?? "expense");
    setParentId(presetParent ? presetParent.id : "");
    setFormOpen(true);
  }

  function openRename(c: Category) {
    setEditing(c);
    setName(c.name);
    setType(c.type);
    setParentId(c.parentCategoryId ?? "");
    setFormOpen(true);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, name });
        toast("Category renamed", "success");
      } else {
        await create.mutateAsync({ name, type, parentCategoryId: parentId || null });
        toast("Category added", "success");
      }
      setFormOpen(false);
    } catch (err) {
      toast(apiErrorMessage(err), "error");
    }
  }

  async function onDelete() {
    if (!toDelete) return;
    try {
      await remove.mutateAsync(toDelete.id);
      toast("Category deleted", "success");
      setToDelete(null);
    } catch (err) {
      toast(apiErrorMessage(err), "error");
    }
  }

  if (isLoading) return <FullPageSpinner />;

  const renderColumn = (title: string, list: Category[], flow: FlowType) => (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">{title}</CardTitle>
        <Button variant="outline" size="sm" onClick={() => openCreate(flow)}>
          <Plus className="h-4 w-4" /> Add
        </Button>
      </CardHeader>
      <CardContent className="space-y-1">
        {list.map((c) => (
          <div key={c.id}>
            <CategoryRow
              c={c}
              onRename={openRename}
              onDelete={setToDelete}
              onAddSub={() => openCreate(flow, c)}
            />
            {c.children?.map((sub) => (
              <div key={sub.id} className="ml-6 flex items-center gap-1">
                <CornerDownRight className="h-3.5 w-3.5 text-muted-foreground" />
                <CategoryRow c={sub} onRename={openRename} onDelete={setToDelete} />
              </div>
            ))}
          </div>
        ))}
      </CardContent>
    </Card>
  );

  return (
    <div>
      <PageHeader
        title="Categories"
        description="Default categories are seeded for you. Add custom ones and sub-categories on top."
      />
      <div className="grid gap-4 md:grid-cols-2">
        {renderColumn("Income", income, "income")}
        {renderColumn("Expense", expense, "expense")}
      </div>

      <Dialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "Rename category" : parentId ? "Add sub-category" : "Add category"}
      >
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cat-name">Name</Label>
            <Input id="cat-name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          </div>
          {!editing && !parentId && (
            <div className="space-y-2">
              <Label htmlFor="cat-type">Type</Label>
              <Select id="cat-type" value={type} onChange={(e) => setType(e.target.value as FlowType)}>
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </Select>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={create.isPending || update.isPending}>
              {editing ? "Save" : "Add"}
            </Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={onDelete}
        title="Delete category"
        message={`Delete "${toDelete?.name}"? Categories in use by transactions cannot be deleted.`}
        loading={remove.isPending}
      />
    </div>
  );
}

function CategoryRow({
  c,
  onRename,
  onDelete,
  onAddSub,
}: {
  c: Category;
  onRename: (c: Category) => void;
  onDelete: (c: Category) => void;
  onAddSub?: () => void;
}) {
  return (
    <div className="group flex flex-1 items-center justify-between rounded-md px-2 py-1.5 hover:bg-accent/50">
      <div className="flex items-center gap-2 text-sm">
        <span>{c.name}</span>
        {c.isDefault && <Badge variant="muted">default</Badge>}
      </div>
      <div className="flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        {onAddSub && (
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onAddSub} aria-label="Add sub-category">
            <Plus className="h-3.5 w-3.5" />
          </Button>
        )}
        {!c.isDefault && (
          <>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onRename(c)} aria-label="Rename">
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDelete(c)} aria-label="Delete">
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
