export type ApprovalPolicy = 'untrusted' | 'on-failure' | 'on-request' | 'never';

export type ApprovalKind = 'patch' | 'exec' | 'net';

export class Approvals {
  constructor(private policy: ApprovalPolicy) {}

  setPolicy(policy: ApprovalPolicy) {
    this.policy = policy;
  }

  getPolicy(): ApprovalPolicy {
    return this.policy;
  }

  needsApproval(kind: ApprovalKind): boolean {
    if (this.policy === 'never') {
      return false;
    }

    if (this.policy === 'untrusted') {
      return true;
    }

    if (this.policy === 'on-request') {
      return false;
    }

    if (this.policy === 'on-failure') {
      return false;
    }

    // default conservative behaviour
    return true;
  }
}
