import { Card } from "@/shared/components/ui/card";
import { FieldGroup } from "@/shared/components/ui/field";

// The parts of a phone entry form (record, edit or refund a transaction,
// create a wallet): field cards in the page column and a fixed Save bar. The
// desktop compositions lay their own fields out and share none of this.

interface FormCardProps {
  children: React.ReactNode;
}

/** A group of fields, a Card in the page column. */
export function FormCard({ children }: Readonly<FormCardProps>) {
  return (
    <Card className="px-5 sm:px-7 sm:py-7">
      <FieldGroup className="max-w-md">{children}</FieldGroup>
    </Card>
  );
}

interface EntrySaveBarProps {
  children: React.ReactNode;
}

/**
 * Save: fixed to the bottom of a phone screen across the column, in-page from
 * 640px ending where the fields do (their 448px plus the card padding).
 */
export function EntrySaveBar({ children }: Readonly<EntrySaveBarProps>) {
  return (
    <div className="border-border bg-chrome/95 supports-backdrop-filter:bg-chrome/85 fixed inset-x-0 bottom-0 z-20 border-t px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 sm:mx-0 sm:max-w-[calc(28rem+1.75rem)]">
        {children}
      </div>
    </div>
  );
}
