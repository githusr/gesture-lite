import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { CameraErrorCode, ModelErrorCode } from './types'

export type Lang = 'zh' | 'en'

/** Every user-facing string, so components stay free of hardcoded copy. */
export interface Messages {
  subtitle: string
  privacy: string
  footer: string
  currentGesture: string
  noGesture: string
  modelLoading: string
  results: string
  model: string
  camera: string
  handDetected: string
  handNotDetected: string
  top3: string
  placeholderReady: string
  placeholderWaiting: string
  classesCount: (n: number) => string
  noLabels: string
  settings: string
  front: string
  back: string
  backend: string
  mirror: string
  showLandmarks: string
  detectionSensitivity: string
  smoothingWindow: string
  scoreThreshold: string
  settingsHint: string
  requestingCamera: string
  alsoLoadingModel: string
  cameraUnavailable: string
  retry: string
  cameraError: Record<CameraErrorCode, string>
  modelError: Record<ModelErrorCode, string>
}

const zh: Messages = {
  subtitle: '浏览器端本地静态手势识别',
  privacy: '本地推理 · 不上传',
  footer: '所有画面与推理均在本地完成，不会上传任何图像。',
  currentGesture: '当前手势',
  noGesture: '未检测到手势',
  modelLoading: '手势模型加载中…',
  results: '识别结果',
  model: '模型',
  camera: '摄像头',
  handDetected: '已检测到手部',
  handNotDetected: '未检测到手部',
  top3: 'Top 3',
  placeholderReady: '将手放入画面以开始识别',
  placeholderWaiting: '等待模型与摄像头就绪…',
  classesCount: (n) => `${n} 个类别`,
  noLabels: '未加载类别表',
  settings: '设置',
  front: '前置',
  back: '后置',
  backend: '推理后端',
  mirror: '镜像画面',
  showLandmarks: '显示手部关键点',
  detectionSensitivity: '检测灵敏度',
  smoothingWindow: '平滑窗口（帧）',
  scoreThreshold: '置信度阈值',
  settingsHint: '提示：更改“检测灵敏度”或“推理后端”会重新初始化对应模块，画面会短暂中断。',
  requestingCamera: '正在请求摄像头权限…',
  alsoLoadingModel: '同时正在加载手势模型',
  cameraUnavailable: '摄像头无法使用',
  retry: '重试',
  cameraError: {
    'insecure-context':
      '摄像头不可用：页面需运行在安全上下文（HTTPS 或 localhost）。当前多为局域网 HTTP，浏览器已隐藏摄像头接口。手机可用 adb reverse 端口转发后访问 localhost，或在浏览器 flags 中将该来源标记为安全。',
    'api-unavailable':
      '当前浏览器不支持摄像头采集（navigator.mediaDevices 不可用）。请使用较新的浏览器，并在 HTTPS 或 localhost 下访问。',
    'permission-denied': '摄像头权限被拒绝。请在浏览器站点设置中允许摄像头访问后重试。',
    'not-found': '未找到可用摄像头，或所选摄像头不支持。',
    'in-use': '摄像头被其他应用占用，请关闭后重试。',
    unknown: '无法访问摄像头，请重试。',
  },
  modelError: {
    'not-loaded':
      '未能加载手势模型。请确认 public/models/gesture.onnx 存在且为有效 ONNX 文件，然后重试。',
    failed: '模型加载失败，请重试。',
  },
}

const en: Messages = {
  subtitle: 'On-device static hand-gesture recognition',
  privacy: 'On-device · no upload',
  footer: 'All video and inference run locally. No image is ever uploaded.',
  currentGesture: 'Current gesture',
  noGesture: 'No gesture',
  modelLoading: 'Loading gesture model…',
  results: 'Result',
  model: 'Model',
  camera: 'Camera',
  handDetected: 'Hand detected',
  handNotDetected: 'No hand detected',
  top3: 'Top 3',
  placeholderReady: 'Put your hand in frame to start',
  placeholderWaiting: 'Waiting for model and camera…',
  classesCount: (n) => `${n} ${n === 1 ? 'class' : 'classes'}`,
  noLabels: 'No labels loaded',
  settings: 'Settings',
  front: 'Front',
  back: 'Back',
  backend: 'Backend',
  mirror: 'Mirror',
  showLandmarks: 'Show landmarks',
  detectionSensitivity: 'Detection sensitivity',
  smoothingWindow: 'Smoothing window (frames)',
  scoreThreshold: 'Confidence threshold',
  settingsHint:
    'Tip: changing detection sensitivity or backend re-initialises that subsystem, so the feed pauses briefly.',
  requestingCamera: 'Requesting camera permission…',
  alsoLoadingModel: 'Loading the gesture model too',
  cameraUnavailable: 'Camera unavailable',
  retry: 'Retry',
  cameraError: {
    'insecure-context':
      'Camera unavailable: the page must run in a secure context (HTTPS or localhost). Plain HTTP over a LAN hides the camera API. Use "adb reverse" to reach localhost on a phone, or mark the origin as secure in your browser flags.',
    'api-unavailable':
      'This browser cannot access the camera (navigator.mediaDevices is unavailable). Use a modern browser over HTTPS or localhost.',
    'permission-denied':
      "Camera permission denied. Allow camera access in your browser's site settings and retry.",
    'not-found': 'No usable camera was found, or the selected camera is unsupported.',
    'in-use': 'The camera is in use by another app. Close it and retry.',
    unknown: 'Unable to access the camera. Please retry.',
  },
  modelError: {
    'not-loaded':
      "Couldn't load the gesture model. Make sure public/models/gesture.onnx exists and is a valid ONNX file, then retry.",
    failed: 'Failed to load the model. Please retry.',
  },
}

export const messages: Record<Lang, Messages> = { zh, en }

const LANG_KEY = 'gesture-lite:lang'

function detectLang(): Lang {
  try {
    const saved = localStorage.getItem(LANG_KEY)
    if (saved === 'zh' || saved === 'en') return saved
  } catch {
    /* storage unavailable */
  }
  if (typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('zh')) {
    return 'zh'
  }
  return 'en'
}

interface I18nValue {
  lang: Lang
  setLang: (lang: Lang) => void
  t: Messages
}

const I18nContext = createContext<I18nValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(detectLang)

  useEffect(() => {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en'
    try {
      localStorage.setItem(LANG_KEY, lang)
    } catch {
      /* storage unavailable */
    }
  }, [lang])

  const value = useMemo<I18nValue>(() => ({ lang, setLang, t: messages[lang] }), [lang])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within <I18nProvider>')
  return ctx
}
