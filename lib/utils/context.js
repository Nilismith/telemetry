import os from 'os'
import gitUrlParse from 'git-url-parse'
import parseGitConfig from 'parse-git-config'
import { machineId } from 'node-machine-id'
import isDocker from 'is-docker'
import ci from 'ci-info'
import { detectPackageManager } from '../utils/detect-package-manager'
import { hash } from './hash'

export async function createContext(nuxt) {
  const rootDir = nuxt.options.rootDir || process.cwd()
  const git = await getGit(rootDir)
  const packageManager = await detectPackageManager(rootDir)

  const sessionId = await getSessionId()
  const projectId = await getProjectId(rootDir, git)
  const projectSession = await getProjectSession()

  return {
    nuxt,
    options: nuxt.options,
    rootDir,
    git,
    sessionId, // machine ID
    projectId, // git creds or path + machine ID
    projectSession, // projectId + sessionId
    nuxtVersion: nuxt.constructor.version.replace('v', ''),
    isEdge: false, // TODO
    isStart: false, // TODO
    nodeVersion: process.version.replace('v', ''),
    os: os.type(),
    environment: getEnv(),
    packageManager
  }
}

const eventContextkeys = [
  'nuxtVersion',
  'isEdge',
  'isStart',
  'nodeVersion',
  'os',
  'environment'
]

export function getEventContext(context) {
  const eventContext = {}
  for (const key of eventContextkeys) {
    eventContext[key] = context[key]
  }
  return eventContext
}

function getEnv() {
  if (process.env.CODESANDBOX_SSE) {
    return 'CSB'
  }
  if (isDocker()) {
    return 'Docker'
  }
  if (ci.isCI) {
    return ci.name
  }

  return 'terminal'
}

export async function getSessionId() {
  const id = await machineId()
  return hash(id)
}

export function getProjectSession(projectId, sessionId) {
  return hash(`${projectId}#${sessionId}`)
}

export async function getProjectId(rootDir, git) {
  let id

  if (git.url) {
    id = `${git.source}#${git.owner}#${git.name}`
  } else {
    const entropy = await machineId()
    id = `${rootDir}#${entropy}`
  }

  return hash(id)
}

async function getGitRemote(rootDir) {
  try {
    const parsed = await parseGitConfig({ cwd: rootDir })
    const gitRemote = parsed['remote "origin"'].url
    return gitRemote
  } catch (err) {
    return null
  }
}

export async function getGit(rootDir) {
  const gitRemote = await getGitRemote(rootDir)

  if (!gitRemote) {
    return {}
  }

  const meta = gitUrlParse(gitRemote)
  const url = meta.toString('https')

  return {
    url,
    gitRemote,
    ...meta
  }
}