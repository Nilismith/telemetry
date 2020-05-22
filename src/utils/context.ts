import os from 'os'
import gitUrlParse from 'git-url-parse'
import parseGitConfig from 'parse-git-config'
import { machineId } from 'node-machine-id'
import isDocker from 'is-docker'
import ci from 'ci-info'
import { Nuxt, Context, GitData } from '../types'
import { detectPackageManager } from './detect-package-manager'
import { hash } from './hash'

export async function createContext (nuxt: Nuxt): Promise<Context> {
  const rootDir = nuxt.options.rootDir || process.cwd()
  const git = await getGit(rootDir)
  const packageManager = await detectPackageManager(rootDir)

  const sessionId = await getSessionId()
  const projectId = await getProjectId(rootDir, git)
  const projectSession = getProjectSession(projectId, sessionId)

  // @ts-ignore
  const nuxtVersion = (nuxt.constructor.version || '').replace('v', '')

  return {
    nuxt,
    options: nuxt.options,
    rootDir,
    git,
    sessionId, // machine ID
    projectId, // git creds or path + machine ID
    projectSession, // projectId + sessionId
    nuxtVersion,
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

export function getEventContext (context: Context): Context {
  const eventContext: Context = {}
  for (const key of eventContextkeys) {
    eventContext[key] = context[key]
  }
  return eventContext
}

function getEnv (): Context['environment'] {
  if (process.env.CODESANDBOX_SSE) {
    return 'CSB'
  }

  if (ci.isCI) {
    return ci.name
  }

  if (isDocker()) {
    return 'Docker'
  }

  return 'unknown'
}

async function getSessionId () {
  const id = await machineId()
  return hash(id)
}

function getProjectSession (projectId: string, sessionId: string) {
  return hash(`${projectId}#${sessionId}`)
}

async function getProjectId (rootDir: string, git?: GitData) {
  let id

  if (git && git.url) {
    id = `${git.source}#${git.owner}#${git.name}`
  } else {
    const entropy = await machineId()
    id = `${rootDir}#${entropy}`
  }

  return hash(id)
}

async function getGitRemote (rootDir: string): Promise<string | null> {
  try {
    const parsed = await parseGitConfig({ cwd: rootDir })
    if (parsed) {
      const gitRemote = parsed['remote "origin"'].url
      return gitRemote
    }
    return null
  } catch (err) {
    return null
  }
}

async function getGit (rootDir: string): Promise<GitData | undefined> {
  const gitRemote = await getGitRemote(rootDir)

  if (!gitRemote) {
    return
  }

  const meta = gitUrlParse(gitRemote)
  const url = meta.toString('https')

  return {
    url,
    gitRemote,
    source: meta.source,
    owner: meta.owner,
    name: meta.name
  }
}
