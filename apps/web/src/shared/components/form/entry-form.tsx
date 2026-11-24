import { Card } from "@/shared/components/ui/card";
import { FieldGroup } from "@/shared/components/ui/field";

// The parts of an entry form (record, edit or refund a transaction, create a
// wallet). On its page they flow in the column; inside the `EntryDialog`
// (from 1024px) they become its scrolling middle and its pinned Save bar.

interface EntryFormBodyProps {
  children: React.ReactNode;
}

/**
 * Everything between the title and Save: the error notice, the form sections
 * and any footer. In the dialog only this scrolls, between its header and
 * Save bar, so the scrollbar never reaches the rounded corners.
 */
export function EntryFormBody({ children }: Readonly<EntryFormBodyProps>) {
  return (
    <div className="contents in-data-entry-dialog:flex in-data-entry-dialog:min-h-0 in-data-entry-dialog:flex-auto in-data-entry-dialog:[scrollbar-width:thin] in-data-entry-dialog:flex-col in-data-entry-dialog:gap-6 in-data-entry-dialog:overflow-y-auto in-data-entry-dialog:border-t in-data-entry-dialog:px-6 in-data-entry-dialog:py-6 in-data-entry-dialog:*:shrink-0">
      {children}
    </div>
  );
}

interface FormCardProps {
  children: React.ReactNode;
}

/** A group of fields: a Card on the page, a hairline-divided section in the dialog. */
export function FormCard({ children }: Readonly<FormCardProps>) {
  return (
    <Card className="px-5 in-data-entry-dialog:overflow-visible in-data-entry-dialog:rounded-none in-data-entry-dialog:bg-transparent in-data-entry-dialog:p-0 in-data-entry-dialog:shadow-none sm:px-7 sm:py-7 in-data-entry-dialog:[[data-slot=card]+&]:border-t in-data-entry-dialog:[[data-slot=card]+&]:pt-6">
      <FieldGroup className="max-w-md">{children}</FieldGroup>
    </Card>
  );
}

interface EntrySaveBarProps {
  children: React.ReactNode;
}

/**
 * Save: fixed to the bottom of a phone screen across the column, in-page from
 * 640px ending where the fields do (their 448px plus the card padding), the
 * dialog's footer.
 */
export function EntrySaveBar({ children }: Readonly<EntrySaveBarProps>) {
  return (
    <div className="border-border bg-chrome/95 supports-backdrop-filter:bg-chrome/85 fixed inset-x-0 bottom-0 z-20 border-t px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur in-data-entry-dialog:shrink-0 in-data-entry-dialog:border-t in-data-entry-dialog:px-6 in-data-entry-dialog:pt-4 in-data-entry-dialog:pb-6 sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 sm:mx-0 sm:max-w-[calc(28rem+1.75rem)]">
        {children}
      </div>
    </div>
  );
}
