import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";

export interface FilterOption {
  value: string;
  label: string;
  /** Muted text after the label: an Archived mark, a parent's name. */
  hint?: string;
  /** Children sit one step in under their parent. */
  indent?: boolean;
}

export interface FilterOptionGroup {
  label?: string;
  options: readonly FilterOption[];
}

interface FilterSelectProps {
  id: string;
  name: string;
  /** The URL's current value; "" is the unfiltered "All …" choice. */
  value: string;
  /** The first, null-valued choice that lifts the filter. */
  allLabel: string;
  groups: readonly FilterOptionGroup[];
  /** Makes the Select controlled by `value`: each choice goes here, "" for "All …". */
  onValueChange?: (value: string) => void;
}

/**
 * One history filter: an uncontrolled Select that submits with the native
 * GET form. "All …" is a real, selectable first item rather than a
 * placeholder, so the filter can be lifted from the same list that set it.
 */
export function FilterSelect({
  id,
  name,
  value,
  allLabel,
  groups,
  onValueChange,
}: Readonly<FilterSelectProps>) {
  const labels = new Map(
    groups.flatMap((group) =>
      group.options.map((option) => [option.value, option] as const),
    ),
  );
  const unknownValue = value && !labels.has(value) ? value : null;
  return (
    <Select
      name={name}
      {...(onValueChange
        ? {
            value: value || null,
            onValueChange: (next: string | null) => onValueChange(next ?? ""),
          }
        : { defaultValue: value || null })}
    >
      <SelectTrigger id={id}>
        <SelectValue>
          {(selected: string | null) => {
            const option = selected ? labels.get(selected) : undefined;
            if (!option) {
              return selected ?? allLabel;
            }
            return (
              <>
                <span className="truncate">{option.label}</span>
                {option.hint && (
                  <span className="text-muted-foreground shrink-0">
                    · {option.hint}
                  </span>
                )}
              </>
            );
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={null} label={allLabel}>
          {allLabel}
        </SelectItem>
        {unknownValue && (
          <SelectItem value={unknownValue} label={unknownValue}>
            {unknownValue}
          </SelectItem>
        )}
        {groups.map((group, index) => (
          <SelectGroup key={group.label ?? index}>
            <SelectSeparator />
            {group.label && <SelectLabel>{group.label}</SelectLabel>}
            {group.options.map((option) => (
              <SelectItem
                key={option.value}
                value={option.value}
                label={option.label}
                className={option.indent ? "pl-7" : undefined}
              >
                {/* Wraps, so a long name keeps its Archived mark in a narrow column. */}
                <span className="wrap-break-word">
                  {option.indent && (
                    <span aria-hidden="true" className="text-muted-foreground">
                      ›{" "}
                    </span>
                  )}
                  {option.label}
                  {option.hint && (
                    <span className="text-muted-foreground font-normal">
                      {" "}
                      · {option.hint}
                    </span>
                  )}
                </span>
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
