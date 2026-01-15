import nodemailer, { Transporter } from 'nodemailer';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

interface BidNotificationData {
  recipientName: string;
  auctionTitle: string;
  athleteName: string;
  eventName: string;
  currentPrice: number;
  bidderName?: string;
}

interface ContractNotificationData {
  recipientName: string;
  athleteName: string;
  brandName: string;
  slotName: string;
  eventName: string;
  price: number;
  contractId: string;
}

interface SettlementNotificationData {
  recipientName: string;
  athleteName: string;
  amount: number;
  bankName: string;
  accountNumber: string;
  contractCount: number;
}

class EmailService {
  private transporter: Transporter | null = null;
  private fromEmail: string;
  private fromName: string;

  constructor() {
    this.fromEmail = process.env.EMAIL_FROM || 'noreply@screengolf.com';
    this.fromName = process.env.EMAIL_FROM_NAME || '스크린골프 스폰서 마켓플레이스';
    this.initTransporter();
  }

  private initTransporter(): void {
    // Check if email configuration exists
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host || !user || !pass) {
      console.log('[Email] SMTP not configured - emails will be logged only');
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass,
      },
    });

    // Verify connection
    this.transporter.verify((error) => {
      if (error) {
        console.error('[Email] SMTP connection failed:', error.message);
      } else {
        console.log('[Email] SMTP server is ready');
      }
    });
  }

  private async sendEmail(options: EmailOptions): Promise<boolean> {
    const { to, subject, html, text } = options;

    // If no transporter, log the email
    if (!this.transporter) {
      console.log('[Email] Would send email:', {
        to,
        subject,
        preview: html.substring(0, 100) + '...',
      });
      return true;
    }

    try {
      await this.transporter.sendMail({
        from: `"${this.fromName}" <${this.fromEmail}>`,
        to,
        subject,
        html,
        text: text || this.stripHtml(html),
      });
      console.log(`[Email] Sent to ${to}: ${subject}`);
      return true;
    } catch (error: any) {
      console.error(`[Email] Failed to send to ${to}:`, error.message);
      return false;
    }
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }

  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
      maximumFractionDigits: 0,
    }).format(amount);
  }

  private getBaseTemplate(content: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>스크린골프 스폰서 마켓플레이스</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; background-color: #f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <!-- Header -->
    <tr>
      <td style="background: linear-gradient(135deg, #10b981 0%, #14b8a6 100%); padding: 24px; text-align: center;">
        <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: bold;">
          스크린골프 스폰서
        </h1>
        <p style="margin: 8px 0 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">
          Micro Sponsor Marketplace
        </p>
      </td>
    </tr>

    <!-- Content -->
    <tr>
      <td style="padding: 32px 24px;">
        ${content}
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="background-color: #f1f5f9; padding: 24px; text-align: center;">
        <p style="margin: 0 0 8px 0; color: #64748b; font-size: 12px;">
          이 이메일은 스크린골프 스폰서 마켓플레이스에서 발송되었습니다.
        </p>
        <p style="margin: 0; color: #94a3b8; font-size: 11px;">
          © 2026 Screen Golf Sponsor Marketplace. All rights reserved.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
    `;
  }

  // ============================================
  // Bid Notifications
  // ============================================

  async sendBidPlacedNotification(
    email: string,
    data: BidNotificationData
  ): Promise<boolean> {
    const content = `
      <h2 style="margin: 0 0 16px 0; color: #1e293b; font-size: 20px;">
        새로운 입찰이 등록되었습니다
      </h2>
      <p style="margin: 0 0 24px 0; color: #475569; line-height: 1.6;">
        안녕하세요, ${data.recipientName}님.<br>
        아래 경매에 새로운 입찰이 등록되었습니다.
      </p>

      <div style="background-color: #f8fafc; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-size: 14px;">슬롯</td>
            <td style="padding: 8px 0; color: #1e293b; font-size: 14px; text-align: right; font-weight: 600;">
              ${data.auctionTitle}
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-size: 14px;">선수</td>
            <td style="padding: 8px 0; color: #1e293b; font-size: 14px; text-align: right;">
              ${data.athleteName}
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-size: 14px;">이벤트</td>
            <td style="padding: 8px 0; color: #1e293b; font-size: 14px; text-align: right;">
              ${data.eventName}
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-size: 14px;">현재가</td>
            <td style="padding: 8px 0; color: #10b981; font-size: 18px; text-align: right; font-weight: bold;">
              ${this.formatCurrency(data.currentPrice)}
            </td>
          </tr>
        </table>
      </div>

      <a href="${process.env.FRONTEND_URL || 'https://screen-golf-sponsor.vercel.app'}/auctions"
         style="display: inline-block; background-color: #10b981; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
        경매 확인하기
      </a>
    `;

    return this.sendEmail({
      to: email,
      subject: `[입찰 알림] ${data.auctionTitle}에 새로운 입찰`,
      html: this.getBaseTemplate(content),
    });
  }

  async sendOutbidNotification(
    email: string,
    data: BidNotificationData
  ): Promise<boolean> {
    const content = `
      <h2 style="margin: 0 0 16px 0; color: #ef4444; font-size: 20px;">
        ⚠️ 입찰이 초과되었습니다
      </h2>
      <p style="margin: 0 0 24px 0; color: #475569; line-height: 1.6;">
        안녕하세요, ${data.recipientName}님.<br>
        다른 입찰자가 더 높은 금액으로 입찰했습니다.
      </p>

      <div style="background-color: #fef2f2; border-radius: 12px; padding: 20px; margin-bottom: 24px; border: 1px solid #fecaca;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-size: 14px;">슬롯</td>
            <td style="padding: 8px 0; color: #1e293b; font-size: 14px; text-align: right; font-weight: 600;">
              ${data.auctionTitle}
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-size: 14px;">현재 최고가</td>
            <td style="padding: 8px 0; color: #ef4444; font-size: 18px; text-align: right; font-weight: bold;">
              ${this.formatCurrency(data.currentPrice)}
            </td>
          </tr>
        </table>
      </div>

      <p style="margin: 0 0 24px 0; color: #475569; line-height: 1.6;">
        최고 입찰자가 되려면 더 높은 금액으로 입찰하세요.
      </p>

      <a href="${process.env.FRONTEND_URL || 'https://screen-golf-sponsor.vercel.app'}/auctions"
         style="display: inline-block; background-color: #ef4444; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
        다시 입찰하기
      </a>
    `;

    return this.sendEmail({
      to: email,
      subject: `[긴급] ${data.auctionTitle} 입찰이 초과되었습니다`,
      html: this.getBaseTemplate(content),
    });
  }

  async sendAuctionWonNotification(
    email: string,
    data: BidNotificationData
  ): Promise<boolean> {
    const content = `
      <h2 style="margin: 0 0 16px 0; color: #10b981; font-size: 20px;">
        🎉 축하합니다! 경매에서 낙찰되었습니다
      </h2>
      <p style="margin: 0 0 24px 0; color: #475569; line-height: 1.6;">
        안녕하세요, ${data.recipientName}님.<br>
        아래 경매에서 최종 낙찰자로 선정되었습니다.
      </p>

      <div style="background-color: #ecfdf5; border-radius: 12px; padding: 20px; margin-bottom: 24px; border: 1px solid #a7f3d0;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-size: 14px;">슬롯</td>
            <td style="padding: 8px 0; color: #1e293b; font-size: 14px; text-align: right; font-weight: 600;">
              ${data.auctionTitle}
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-size: 14px;">선수</td>
            <td style="padding: 8px 0; color: #1e293b; font-size: 14px; text-align: right;">
              ${data.athleteName}
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-size: 14px;">이벤트</td>
            <td style="padding: 8px 0; color: #1e293b; font-size: 14px; text-align: right;">
              ${data.eventName}
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-size: 14px;">낙찰가</td>
            <td style="padding: 8px 0; color: #10b981; font-size: 20px; text-align: right; font-weight: bold;">
              ${this.formatCurrency(data.currentPrice)}
            </td>
          </tr>
        </table>
      </div>

      <p style="margin: 0 0 24px 0; color: #475569; line-height: 1.6;">
        계약서가 자동으로 생성되었습니다. 계약 페이지에서 서명을 완료해주세요.
      </p>

      <a href="${process.env.FRONTEND_URL || 'https://screen-golf-sponsor.vercel.app'}/contracts"
         style="display: inline-block; background-color: #10b981; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
        계약서 확인하기
      </a>
    `;

    return this.sendEmail({
      to: email,
      subject: `[낙찰] 축하합니다! ${data.auctionTitle} 경매에서 낙찰되었습니다`,
      html: this.getBaseTemplate(content),
    });
  }

  // ============================================
  // Contract Notifications
  // ============================================

  async sendContractCreatedNotification(
    email: string,
    data: ContractNotificationData
  ): Promise<boolean> {
    const content = `
      <h2 style="margin: 0 0 16px 0; color: #1e293b; font-size: 20px;">
        📄 새로운 계약서가 생성되었습니다
      </h2>
      <p style="margin: 0 0 24px 0; color: #475569; line-height: 1.6;">
        안녕하세요, ${data.recipientName}님.<br>
        스폰서십 계약서가 생성되었습니다. 내용을 확인하고 서명해주세요.
      </p>

      <div style="background-color: #f8fafc; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-size: 14px;">슬롯</td>
            <td style="padding: 8px 0; color: #1e293b; font-size: 14px; text-align: right; font-weight: 600;">
              ${data.slotName}
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-size: 14px;">브랜드</td>
            <td style="padding: 8px 0; color: #1e293b; font-size: 14px; text-align: right;">
              ${data.brandName}
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-size: 14px;">선수</td>
            <td style="padding: 8px 0; color: #1e293b; font-size: 14px; text-align: right;">
              ${data.athleteName}
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-size: 14px;">이벤트</td>
            <td style="padding: 8px 0; color: #1e293b; font-size: 14px; text-align: right;">
              ${data.eventName}
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-size: 14px;">계약금액</td>
            <td style="padding: 8px 0; color: #10b981; font-size: 18px; text-align: right; font-weight: bold;">
              ${this.formatCurrency(data.price)}
            </td>
          </tr>
        </table>
      </div>

      <a href="${process.env.FRONTEND_URL || 'https://screen-golf-sponsor.vercel.app'}/contracts/${data.contractId}"
         style="display: inline-block; background-color: #10b981; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
        계약서 서명하기
      </a>
    `;

    return this.sendEmail({
      to: email,
      subject: `[계약] 새로운 스폰서십 계약서 - ${data.slotName}`,
      html: this.getBaseTemplate(content),
    });
  }

  async sendContractSignedNotification(
    email: string,
    data: ContractNotificationData
  ): Promise<boolean> {
    const content = `
      <h2 style="margin: 0 0 16px 0; color: #10b981; font-size: 20px;">
        ✅ 계약 서명이 완료되었습니다
      </h2>
      <p style="margin: 0 0 24px 0; color: #475569; line-height: 1.6;">
        안녕하세요, ${data.recipientName}님.<br>
        스폰서십 계약 서명이 완료되었습니다.
      </p>

      <div style="background-color: #ecfdf5; border-radius: 12px; padding: 20px; margin-bottom: 24px; border: 1px solid #a7f3d0;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-size: 14px;">슬롯</td>
            <td style="padding: 8px 0; color: #1e293b; font-size: 14px; text-align: right; font-weight: 600;">
              ${data.slotName}
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-size: 14px;">브랜드</td>
            <td style="padding: 8px 0; color: #1e293b; font-size: 14px; text-align: right;">
              ${data.brandName}
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-size: 14px;">선수</td>
            <td style="padding: 8px 0; color: #1e293b; font-size: 14px; text-align: right;">
              ${data.athleteName}
            </td>
          </tr>
        </table>
      </div>

      <p style="margin: 0 0 24px 0; color: #475569; line-height: 1.6;">
        다음 단계: 브랜드에서 소재를 업로드하면 알림을 보내드립니다.
      </p>

      <a href="${process.env.FRONTEND_URL || 'https://screen-golf-sponsor.vercel.app'}/contracts/${data.contractId}"
         style="display: inline-block; background-color: #10b981; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
        계약 상세 보기
      </a>
    `;

    return this.sendEmail({
      to: email,
      subject: `[계약 완료] ${data.slotName} 스폰서십 계약이 체결되었습니다`,
      html: this.getBaseTemplate(content),
    });
  }

  // ============================================
  // Settlement Notifications
  // ============================================

  async sendSettlementCompletedNotification(
    email: string,
    data: SettlementNotificationData
  ): Promise<boolean> {
    const content = `
      <h2 style="margin: 0 0 16px 0; color: #10b981; font-size: 20px;">
        💰 정산이 완료되었습니다
      </h2>
      <p style="margin: 0 0 24px 0; color: #475569; line-height: 1.6;">
        안녕하세요, ${data.recipientName}님.<br>
        스폰서십 정산금이 입금되었습니다.
      </p>

      <div style="background-color: #ecfdf5; border-radius: 12px; padding: 20px; margin-bottom: 24px; border: 1px solid #a7f3d0;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-size: 14px;">선수</td>
            <td style="padding: 8px 0; color: #1e293b; font-size: 14px; text-align: right; font-weight: 600;">
              ${data.athleteName}
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-size: 14px;">정산 건수</td>
            <td style="padding: 8px 0; color: #1e293b; font-size: 14px; text-align: right;">
              ${data.contractCount}건
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-size: 14px;">입금 계좌</td>
            <td style="padding: 8px 0; color: #1e293b; font-size: 14px; text-align: right;">
              ${data.bankName} ${data.accountNumber}
            </td>
          </tr>
          <tr>
            <td style="padding: 12px 0; color: #64748b; font-size: 14px; border-top: 1px solid #d1fae5;">정산 금액</td>
            <td style="padding: 12px 0; color: #10b981; font-size: 24px; text-align: right; font-weight: bold; border-top: 1px solid #d1fae5;">
              ${this.formatCurrency(data.amount)}
            </td>
          </tr>
        </table>
      </div>

      <a href="${process.env.FRONTEND_URL || 'https://screen-golf-sponsor.vercel.app'}/settlements"
         style="display: inline-block; background-color: #10b981; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
        정산 내역 확인하기
      </a>
    `;

    return this.sendEmail({
      to: email,
      subject: `[정산 완료] ${this.formatCurrency(data.amount)}이 입금되었습니다`,
      html: this.getBaseTemplate(content),
    });
  }

  // ============================================
  // KYC Notifications
  // ============================================

  async sendKycApprovedNotification(
    email: string,
    recipientName: string,
    role: 'BRAND' | 'ATHLETE'
  ): Promise<boolean> {
    const roleLabel = role === 'BRAND' ? '브랜드' : '선수';

    const content = `
      <h2 style="margin: 0 0 16px 0; color: #10b981; font-size: 20px;">
        ✅ KYC 인증이 승인되었습니다
      </h2>
      <p style="margin: 0 0 24px 0; color: #475569; line-height: 1.6;">
        안녕하세요, ${recipientName}님.<br>
        ${roleLabel} 계정의 KYC 인증이 승인되었습니다.
      </p>

      <div style="background-color: #ecfdf5; border-radius: 12px; padding: 20px; margin-bottom: 24px; border: 1px solid #a7f3d0; text-align: center;">
        <p style="margin: 0; color: #10b981; font-size: 18px; font-weight: bold;">
          🎉 이제 모든 기능을 이용할 수 있습니다!
        </p>
      </div>

      <p style="margin: 0 0 24px 0; color: #475569; line-height: 1.6;">
        ${role === 'BRAND'
          ? '이제 경매에 입찰하고 스폰서십 계약을 체결할 수 있습니다.'
          : '이제 슬롯을 등록하고 스폰서십 수익을 얻을 수 있습니다.'}
      </p>

      <a href="${process.env.FRONTEND_URL || 'https://screen-golf-sponsor.vercel.app'}/dashboard"
         style="display: inline-block; background-color: #10b981; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
        대시보드로 이동
      </a>
    `;

    return this.sendEmail({
      to: email,
      subject: `[KYC 승인] ${recipientName}님의 ${roleLabel} 계정이 인증되었습니다`,
      html: this.getBaseTemplate(content),
    });
  }

  async sendKycRejectedNotification(
    email: string,
    recipientName: string,
    role: 'BRAND' | 'ATHLETE',
    reason: string
  ): Promise<boolean> {
    const roleLabel = role === 'BRAND' ? '브랜드' : '선수';

    const content = `
      <h2 style="margin: 0 0 16px 0; color: #ef4444; font-size: 20px;">
        ❌ KYC 인증이 거절되었습니다
      </h2>
      <p style="margin: 0 0 24px 0; color: #475569; line-height: 1.6;">
        안녕하세요, ${recipientName}님.<br>
        ${roleLabel} 계정의 KYC 인증이 거절되었습니다.
      </p>

      <div style="background-color: #fef2f2; border-radius: 12px; padding: 20px; margin-bottom: 24px; border: 1px solid #fecaca;">
        <p style="margin: 0 0 8px 0; color: #64748b; font-size: 14px;">거절 사유:</p>
        <p style="margin: 0; color: #ef4444; font-size: 16px; font-weight: 500;">
          ${reason}
        </p>
      </div>

      <p style="margin: 0 0 24px 0; color: #475569; line-height: 1.6;">
        프로필 페이지에서 서류를 다시 제출해주세요.
      </p>

      <a href="${process.env.FRONTEND_URL || 'https://screen-golf-sponsor.vercel.app'}/profile"
         style="display: inline-block; background-color: #ef4444; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
        서류 다시 제출하기
      </a>
    `;

    return this.sendEmail({
      to: email,
      subject: `[KYC 거절] ${recipientName}님의 인증 서류를 다시 확인해주세요`,
      html: this.getBaseTemplate(content),
    });
  }
}

export const emailService = new EmailService();
