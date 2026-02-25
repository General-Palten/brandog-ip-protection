const fs = require('fs')
const path = require('path')
const vm = require('vm')
const ts = require('typescript')

const rootDir = path.resolve(__dirname, '..')

function readFile(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8')
}

function fail(message) {
  throw new Error(message)
}

function assert(condition, message) {
  if (!condition) {
    fail(message)
  }
}

function parseStringUnion(source, typeName) {
  const escapedName = typeName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = source.match(new RegExp(`export\\s+type\\s+${escapedName}\\s*=\\s*([\\s\\S]*?);`))
  if (!match) {
    fail(`Could not find type union for ${typeName}`)
  }

  const values = Array.from(match[1].matchAll(/'([^']+)'/g)).map((entry) => entry[1])
  if (values.length === 0) {
    fail(`No string literals found in ${typeName}`)
  }

  return values
}

function loadCaseStatusModule() {
  const filePath = path.join(rootDir, 'lib', 'case-status.ts')
  const source = fs.readFileSync(filePath, 'utf8')
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: filePath,
  }).outputText

  const module = { exports: {} }
  const sandbox = {
    module,
    exports: module.exports,
    require,
    __filename: filePath,
    __dirname: path.dirname(filePath),
    console,
    process,
  }

  vm.runInNewContext(transpiled, sandbox, { filename: filePath })
  return module.exports
}

function assertArrayEquals(actual, expected, label) {
  const actualText = JSON.stringify(actual)
  const expectedText = JSON.stringify(expected)
  assert(
    actualText === expectedText,
    `${label} mismatch.\nExpected: ${expectedText}\nActual:   ${actualText}`
  )
}

function run() {
  const expectedInfringementStatuses = [
    'detected',
    'pending_review',
    'in_progress',
    'resolved',
    'rejected',
  ]

  const expectedAssetScanStatuses = [
    'pending',
    'queued',
    'scanning',
    'success',
    'failed',
    'skipped',
  ]

  const expectedCaseUpdateTypes = [
    'takedown_initiated',
    'platform_contacted',
    'dmca_sent',
    'awaiting_response',
    'follow_up_sent',
    'escalated',
    'content_removed',
    'case_closed',
    'custom',
  ]

  const typesSource = readFile('types.ts')
  const infringementStatusUnion = parseStringUnion(typesSource, 'InfringementStatus')
  const assetScanStatusUnion = parseStringUnion(typesSource, 'AssetScanStatus')
  const caseUpdateTypeUnion = parseStringUnion(typesSource, 'CaseUpdateType')

  assertArrayEquals(infringementStatusUnion, expectedInfringementStatuses, 'InfringementStatus union')
  assertArrayEquals(assetScanStatusUnion, expectedAssetScanStatuses, 'AssetScanStatus union')
  assertArrayEquals(caseUpdateTypeUnion, expectedCaseUpdateTypes, 'CaseUpdateType union')

  const caseStatus = loadCaseStatusModule()
  const {
    CANONICAL_INFRINGEMENT_STATUSES,
    validateCaseStatusTransition,
  } = caseStatus

  assert(
    Array.isArray(CANONICAL_INFRINGEMENT_STATUSES),
    'CANONICAL_INFRINGEMENT_STATUSES must be exported as an array'
  )
  assertArrayEquals(
    CANONICAL_INFRINGEMENT_STATUSES,
    expectedInfringementStatuses,
    'CANONICAL_INFRINGEMENT_STATUSES'
  )

  const validTransitions = [
    ['detected', 'pending_review', 'agent_detection_complete'],
    ['pending_review', 'in_progress', 'company_enforce'],
    ['pending_review', 'rejected', 'company_dismiss'],
    ['pending_review', 'rejected', 'company_whitelist'],
    ['in_progress', 'resolved', 'lawyer_resolve'],
    ['in_progress', 'rejected', 'lawyer_reject'],
    ['resolved', 'detected', 'manual_reopen'],
    ['rejected', 'detected', 'manual_reopen'],
  ]

  for (const [from, to, action] of validTransitions) {
    const result = validateCaseStatusTransition(from, to, action)
    assert(result.ok === true, `Expected valid transition ${from} -> ${to} with ${action}`)
  }

  const missingActionResult = validateCaseStatusTransition('pending_review', 'in_progress')
  assert(missingActionResult.ok === false, 'pending_review -> in_progress must fail without company_enforce')
  if (!missingActionResult.ok) {
    assert(
      missingActionResult.error.code === 'missing_required_action',
      'pending_review -> in_progress should return missing_required_action'
    )
  }

  const invalidTransitions = [
    ['detected', 'in_progress'],
    ['detected', 'resolved'],
    ['pending_review', 'resolved'],
    ['in_progress', 'detected'],
    ['resolved', 'in_progress'],
    ['rejected', 'pending_review'],
  ]

  for (const [from, to] of invalidTransitions) {
    const result = validateCaseStatusTransition(from, to)
    assert(result.ok === false, `Expected invalid transition ${from} -> ${to} to be blocked`)
    if (!result.ok) {
      assert(result.error.code === 'invalid_transition', `Expected invalid_transition for ${from} -> ${to}`)
    }
  }

  console.log('Contract checks passed: enums and case status transitions are aligned.')
}

run()
