import { Injectable } from "@nestjs/common";

import { writeStructuredLog } from "../../../platform/index.js";

@Injectable()
export class DemoEmailProvider {
  private readonly acceptedKeys = new Set<string>();

  public async send(input: {
    readonly deduplicationKey: string;
    readonly notificationId: string;
    readonly recipientEmail: string;
    readonly ticketNumber: number;
  }): Promise<void> {
    await Promise.resolve();
    if (this.acceptedKeys.has(input.deduplicationKey)) return;
    this.acceptedKeys.add(input.deduplicationKey);
    writeStructuredLog("support-worker", "info", "notification.email.accepted", {
      deduplicationKey: input.deduplicationKey,
      notificationId: input.notificationId,
      provider: "local-demo",
      ticketNumber: input.ticketNumber,
    });
  }
}
