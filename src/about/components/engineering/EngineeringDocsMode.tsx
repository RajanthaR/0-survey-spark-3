import { DEFAULT_ENGINEERING_DOC, DocViewer } from "@/about/components/engineering/DocViewer";
import { DocSidebar } from "@/about/components/engineering/DocSidebar";

export default function EngineeringDocsMode({ doc }: { doc?: string }) {
  const activeDoc = doc || DEFAULT_ENGINEERING_DOC;

  return (
    <div className="grid min-w-0 gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
      <DocSidebar activeDoc={activeDoc} />
      <DocViewer doc={activeDoc} />
    </div>
  );
}
