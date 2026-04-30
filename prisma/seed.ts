import { PrismaClient } from '@prisma/client'
import { MockCantonAdapter } from '../src/lib/canton/mock-adapter'

const prisma = new PrismaClient()
const adapter = new MockCantonAdapter()

async function main() {
  console.log('Seeding FlowLedger with demo data...')

  // Create demo users
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@flowledger.io' },
    update: {},
    create: {
      email: 'admin@flowledger.io',
      name: 'Alex Admin',
      cantonPartyId: 'alex::' + 'a'.repeat(64),
    },
  })

  const approver = await prisma.user.upsert({
    where: { email: 'approver@flowledger.io' },
    update: {},
    create: {
      email: 'approver@flowledger.io',
      name: 'Sam Approver',
    },
  })

  // Create org
  const org = await prisma.organization.upsert({
    where: { slug: 'flowledger' },
    update: {},
    create: {
      name: 'FlowLedger Demo',
      slug: 'flowledger',
      treasuryPartyId: 'treasury::' + 'b'.repeat(64),
      defaultAsset: 'USDCX',
      approvalThreshold: 1000,
    },
  })

  // Add members
  await prisma.organizationMember.upsert({
    where: {
      organizationId_userId: {
        organizationId: org.id,
        userId: adminUser.id,
      },
    },
    update: {},
    create: { organizationId: org.id, userId: adminUser.id, role: 'ADMIN' },
  })

  await prisma.organizationMember.upsert({
    where: {
      organizationId_userId: {
        organizationId: org.id,
        userId: approver.id,
      },
    },
    update: {},
    create: {
      organizationId: org.id,
      userId: approver.id,
      role: 'APPROVER',
    },
  })

  // Create vendors
  const vendorData = [
    { name: 'Alice Chen', email: 'alice@dev.io', hint: 'alice-chen' },
    { name: 'Bob Martinez', email: 'bob@design.io', hint: 'bob-martinez' },
    { name: 'Carol White', email: 'carol@audit.io', hint: 'carol-white' },
    { name: 'David Kim', email: 'david@node.io', hint: 'david-kim' },
    { name: 'Eva Santos', email: 'eva@market.io', hint: 'eva-santos' },
  ]

  const vendors = []
  for (const v of vendorData) {
    const fingerprint = Array.from({ length: 64 }, (_, i) =>
      ((v.hint.charCodeAt(i % v.hint.length) + i) % 16).toString(16)
    ).join('')
    const partyId = `${v.hint}::${fingerprint}`
    const preApprovalResult = await adapter.setTransferPreApproval(partyId)

    const vendor = await prisma.vendor.upsert({
      where: { id: v.hint },
      update: {},
      create: {
        id: v.hint,
        organizationId: org.id,
        name: v.name,
        email: v.email,
        cantonPartyId: partyId,
        preferredAsset: 'USDCX',
        preApprovalStatus: 'ACTIVE',
        preApprovalExpiry: preApprovalResult.expiresAt,
        status: 'ACTIVE',
      },
    })
    vendors.push(vendor)
  }

  // Set carol's pre-approval as expired for testing
  await prisma.vendor.update({
    where: { id: 'carol-white' },
    data: {
      preApprovalStatus: 'EXPIRED',
      preApprovalExpiry: new Date(Date.now() - 1000),
    },
  })

  // Create invoices in various states
  const year = new Date().getFullYear()
  const invoiceScenarios = [
    {
      vendor: vendors[0],
      amount: 850,
      status: 'APPROVED',
      desc: 'Frontend development — April 2024',
      daysOffset: 7,
    },
    {
      vendor: vendors[1],
      amount: 1200,
      status: 'PENDING_APPROVAL',
      desc: 'UI/UX design — Sprint 12',
      daysOffset: 14,
    },
    {
      vendor: vendors[2],
      amount: 2500,
      status: 'APPROVED',
      desc: 'Smart contract audit — Q1 2024',
      daysOffset: 3,
    },
    {
      vendor: vendors[3],
      amount: 400,
      status: 'APPROVED',
      desc: 'Node operations — March 2024',
      daysOffset: -2,
    },
    {
      vendor: vendors[4],
      amount: 650,
      status: 'APPROVED',
      desc: 'Marketing — March 2024',
      daysOffset: 5,
    },
    {
      vendor: vendors[0],
      amount: 1100,
      status: 'PAID',
      desc: 'Frontend development — March 2024',
      daysOffset: -10,
    },
    {
      vendor: vendors[1],
      amount: 800,
      status: 'REJECTED',
      desc: 'Design revisions — Feb 2024',
      daysOffset: -20,
    },
    {
      vendor: vendors[3],
      amount: 350,
      status: 'DRAFT',
      desc: 'Node operations — April 2024',
      daysOffset: 20,
    },
  ]

  const invoices = []
  for (let i = 0; i < invoiceScenarios.length; i++) {
    const s = invoiceScenarios[i]
    const invoiceNumber = `INV-${year}-${String(i + 1).padStart(3, '0')}`
    const dueDate = new Date(Date.now() + s.daysOffset * 24 * 60 * 60 * 1000)

    let cantonContractId: string | undefined
    if (s.status !== 'DRAFT') {
      const contract = await adapter.createInvoiceContract({
        invoiceId: `seed-invoice-${i}`,
        orgId: org.id,
        vendorPartyId: s.vendor.cantonPartyId,
        treasuryPartyId: org.treasuryPartyId,
        amount: s.amount,
        assetId: 'USDCX',
        description: s.desc,
      })
      cantonContractId = contract.contractId
    }

    // Check if invoice already exists
    const existing = await prisma.invoice.findUnique({
      where: { organizationId_invoiceNumber: { organizationId: org.id, invoiceNumber } },
    })

    const invoice = existing ?? await prisma.invoice.create({
      data: {
        organizationId: org.id,
        vendorId: s.vendor.id,
        invoiceNumber,
        amount: s.amount,
        assetId: 'USDCX',
        description: s.desc,
        dueDate,
        status: s.status,
        cantonContractId,
      },
    })
    invoices.push(invoice)

    if (s.status === 'REJECTED' && !existing) {
      await prisma.invoiceApproval.create({
        data: {
          invoiceId: invoice.id,
          approverId: approver.id,
          decision: 'REJECTED',
          note: 'Missing proper documentation',
        },
      })
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { rejectionNote: 'Missing proper documentation' },
      })
    }

    if ((s.status === 'APPROVED' || s.status === 'PAID') && !existing) {
      await prisma.invoiceApproval.create({
        data: {
          invoiceId: invoice.id,
          approverId: approver.id,
          decision: 'APPROVED',
        },
      })
    }
  }

  // Create a paid batch with real mock transfer receipts
  const paidInvoice = invoices.find((i) => i.status === 'PAID')

  if (paidInvoice) {
    const existingBatch = await prisma.payrollBatch.findFirst({
      where: { organizationId: org.id, name: 'March 2024 — Dev Contractors' },
    })

    if (!existingBatch) {
      const batchContract = await adapter.createBatchContract({
        batchId: 'seed-batch-1',
        orgId: org.id,
        treasuryPartyId: org.treasuryPartyId,
        invoiceIds: [paidInvoice.id],
        totalAmount: paidInvoice.amount,
        assetId: 'USDCX',
        featuredApp: true,
      })

      const batch = await prisma.payrollBatch.create({
        data: {
          organizationId: org.id,
          name: 'March 2024 — Dev Contractors',
          assetId: 'USDCX',
          totalAmount: paidInvoice.amount,
          itemCount: 1,
          status: 'PAID',
          cantonContractId: batchContract.contractId,
          executedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
          items: {
            create: {
              invoiceId: paidInvoice.id,
              amount: paidInvoice.amount,
              status: 'PAID',
            },
          },
        },
      })

      const transfer = await adapter.executeTransfer({
        senderPartyId: org.treasuryPartyId,
        receiverPartyId: vendors[0].cantonPartyId,
        amount: paidInvoice.amount,
        assetId: 'USDCX',
        invoiceId: paidInvoice.id,
        batchId: batch.id,
        featuredApp: true,
      })

      const existingReceipt = await prisma.paymentReceipt.findUnique({
        where: { invoiceId: paidInvoice.id },
      })

      if (!existingReceipt) {
        await prisma.paymentReceipt.create({
          data: {
            invoiceId: paidInvoice.id,
            batchId: batch.id,
            payerParty: org.treasuryPartyId,
            payeeParty: vendors[0].cantonPartyId,
            amount: paidInvoice.amount,
            assetId: 'USDCX',
            updateId: transfer.updateId,
            transferObjectJson: transfer.transferObjectJson,
            paidAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
          },
        })
      }
    }
  }

  // Log audit events
  const auditEventDefs = [
    {
      eventType: 'ORG_CREATED',
      entityType: 'org',
      entityId: org.id,
      metadata: { name: org.name },
    },
    ...vendors.map((v) => ({
      eventType: 'VENDOR_ADDED',
      entityType: 'vendor',
      entityId: v.id,
      metadata: { name: v.name },
    })),
    ...invoices
      .filter((i) => i.status !== 'DRAFT')
      .map((i) => ({
        eventType: 'INVOICE_SUBMITTED',
        entityType: 'invoice',
        entityId: i.id,
        metadata: { invoiceNumber: i.invoiceNumber },
      })),
  ]

  for (const e of auditEventDefs) {
    const exists = await prisma.auditEvent.findFirst({
      where: {
        organizationId: org.id,
        eventType: e.eventType,
        entityId: e.entityId,
      },
    })
    if (!exists) {
      await prisma.auditEvent.create({
        data: {
          organizationId: org.id,
          actorId: adminUser.id,
          eventType: e.eventType,
          entityType: e.entityType,
          entityId: e.entityId,
          metadataJson: JSON.stringify(e.metadata),
        },
      })
    }
  }

  console.log('\n========== SEED COMPLETE ==========')
  console.log('Demo login: admin@flowledger.io')
  console.log('Dev sign-in URL: http://localhost:3000/api/dev/signin?email=admin@flowledger.io')
  console.log('Org: http://localhost:3000/flowledger/dashboard')
  console.log('===================================\n')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
