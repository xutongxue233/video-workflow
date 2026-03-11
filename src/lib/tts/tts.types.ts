export type TtsSynthesizeInput = {
  scriptText: string;
  voiceStyle: string;
};

export type TtsSynthesizeResult = {
  content: Buffer;
  mimeType: string;
  extension: string;
  provider: string;
};

export type TtsProvider = {
  synthesize(input: TtsSynthesizeInput): Promise<TtsSynthesizeResult>;
};
