import { Select } from "@/components/ui/select";
import type { Category, FlowType } from "@/types";

/** Flattened category dropdown for a given flow type — parents plus indented children. */
export function CategorySelect({
  categories,
  type,
  value,
  onChange,
  id,
}: {
  categories: Category[];
  type: FlowType;
  value: string;
  onChange: (id: string) => void;
  id?: string;
}) {
  const parents = categories.filter((c) => c.type === type && !c.parentCategoryId);

  return (
    <Select id={id} value={value} onChange={(e) => onChange(e.target.value)} required>
      <option value="" disabled>
        Select a category
      </option>
      {parents.map((p) => (
        <optgroup key={p.id} label={p.name}>
          <option value={p.id}>{p.name}</option>
          {p.children?.map((child) => (
            <option key={child.id} value={child.id}>
              &nbsp;&nbsp;— {child.name}
            </option>
          ))}
        </optgroup>
      ))}
    </Select>
  );
}
