export class ProoflineError extends Error {
  constructor(message, { code = "PROOFLINE_ERROR", exitCode = 2 } = {}) {
    super(message);
    this.name = "ProoflineError";
    this.code = code;
    this.exitCode = exitCode;
  }
}

