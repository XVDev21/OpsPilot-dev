import type { UseFormRegisterReturn } from "react-hook-form";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { sampleTeamMembers } from "@/lib/collaboration/sample-team";

export function CollaboratorSelect({
  id,
  label,
  description,
  registration,
}: {
  id: string;
  label: string;
  description: string;
  registration: UseFormRegisterReturn;
}) {
  return (
    <Field id={id} label={label} description={description} optional>
      <Select id={id} {...registration}>
        <option value="">Unassigned</option>
        {sampleTeamMembers.map((member) => (
          <option key={member.id} value={member.id}>
            {member.name} — {member.role}
          </option>
        ))}
      </Select>
      <p className="text-[0.6875rem] leading-5 text-foreground-soft">
        Sample profile only. No notification or access grant is created.
      </p>
    </Field>
  );
}
