declare module 'mammoth/mammoth.browser.min.js' {
  interface ConvertResult {
    value: string;
    messages: { type: string; message: string }[];
  }
  const mammoth: {
    convertToHtml(input: { arrayBuffer: ArrayBuffer }, options?: object): Promise<ConvertResult>;
  };
  export default mammoth;
}
