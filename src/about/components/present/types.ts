import type { ReactNode } from "react";

export type TitleSlideProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  meta?: string;
};

export type TextSlideProps = {
  eyebrow?: string;
  text: string;
  supportingText?: string;
};

export type DiagramSlideProps = {
  title: string;
  source: string;
  eyebrow?: string;
};

export type ComponentSlideProps = {
  title: string;
  eyebrow?: string;
  children: ReactNode;
  footnote?: string;
};

export type SlideDefinition =
  | { id: string; kind: "title"; props: TitleSlideProps; speakerHint?: string }
  | { id: string; kind: "text"; props: TextSlideProps; speakerHint?: string }
  | { id: string; kind: "diagram"; props: DiagramSlideProps; speakerHint?: string }
  | { id: string; kind: "component"; props: ComponentSlideProps; speakerHint?: string };
