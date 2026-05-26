import { MermaidBlock } from "@/about/components/MermaidBlock";

import sampleFlowSource from "@/about/diagrams/sample-flow.mmd?raw";

export { sampleFlowSource };

export function SampleFlowDiagram() {
  return <MermaidBlock source={sampleFlowSource} />;
}
