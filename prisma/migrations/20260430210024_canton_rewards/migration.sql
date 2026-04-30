-- AlterTable
ALTER TABLE "PaymentReceipt" ADD COLUMN "activityMarkerContractId" TEXT;
ALTER TABLE "PaymentReceipt" ADD COLUMN "appRewardCouponId" TEXT;
ALTER TABLE "PaymentReceipt" ADD COLUMN "rewardEstimateCC" REAL;

-- AlterTable
ALTER TABLE "PayrollBatch" ADD COLUMN "activityMarkerContractId" TEXT;
ALTER TABLE "PayrollBatch" ADD COLUMN "totalRewardEstimateCC" REAL;

-- AlterTable
ALTER TABLE "Vendor" ADD COLUMN "walletProxyContractId" TEXT;
ALTER TABLE "Vendor" ADD COLUMN "walletProxyCreatedAt" DATETIME;
ALTER TABLE "Vendor" ADD COLUMN "walletProxyStatus" TEXT DEFAULT 'PENDING';

-- CreateTable
CREATE TABLE "RewardSummary" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "periodStart" DATETIME NOT NULL,
    "periodEnd" DATETIME NOT NULL,
    "totalTransactions" INTEGER NOT NULL,
    "totalRewardCoupons" INTEGER NOT NULL,
    "estimatedCCEarned" REAL NOT NULL,
    "estimatedUSDValue" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RewardSummary_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
