// 기준/폴백 언어. 이 객체의 키에서 MessageKey 타입이 도출된다.
// 다른 언어 파일은 Record<MessageKey, string>으로 강제되어 키 누락 시 빌드 실패.
// 결정 배경: docs/adr/0001-i18n-custom-vs-library.md
const en = {
  // common
  'common.cancel': 'Cancel',
  'common.save': 'Save',
  'common.add': 'Add',
  'common.delete': 'Delete',
  'common.back': 'Back',
  'common.undo': 'Undo',
  'common.saveFail': 'Failed to save.',

  // nav
  'nav.today': 'Today',
  'nav.tags': 'Tags',
  'nav.logs': 'Logs',
  'nav.profile': 'Profile',

  // landing
  'landing.signIn': 'Sign in',
  'landing.getStarted': 'Get started',
  'landing.eyebrow': 'time tracking',
  'landing.heroTitle': 'Every second accounted for.',
  'landing.heroSubtitle': 'A focused workspace for tracking what matters. Start, stop, and review your time with precision.',
  'landing.ctaFree': "Get started — it's free",
  'landing.haveAccountInline': 'Already have an account? Sign in',
  'landing.feature1Title': 'Hierarchical tags',
  'landing.feature1Desc': 'Organize your work into nested tags. Track time at any level.',
  'landing.feature2Title': 'Precise stopwatch',
  'landing.feature2Desc': 'Session, daily, and lifetime totals — always up to date.',
  'landing.feature3Title': 'Full history',
  'landing.feature3Desc': 'Browse and edit every record. Nothing is lost.',

  // auth shared
  'auth.email': 'Email',
  'auth.password': 'Password',

  // login
  'login.eyebrow': 'sign in',
  'login.title': 'Welcome back.',
  'login.submit': 'Sign in',
  'login.or': 'or',
  'login.google': 'Continue with Google',
  'login.noAccount': "Don't have an account?",
  'login.registerLink': 'Register',
  'login.errorInvalid': 'Email or password is incorrect.',

  // oauth callback
  'oauth.signingIn': 'Signing in...',
  'oauth.backToLogin': 'Back to Login',
  'oauth.googleFail': 'Google sign-in failed. Please try again.',

  // register
  'register.eyebrow': 'create account',
  'register.title': 'Get started.',
  'register.name': 'Name',
  'register.namePlaceholder': 'Your name',
  'register.submit': 'Create account',
  'register.haveAccount': 'Already have an account?',
  'register.signInLink': 'Sign in',
  'register.pwMin': 'Password must be at least 8 characters.',
  'register.pwUpper': 'Must include an uppercase letter.',
  'register.pwLower': 'Must include a lowercase letter.',
  'register.pwDigit': 'Must include a number.',
  'register.fail': 'Registration failed. Please try again.',

  // today
  'today.recording': 'recording',
  'today.selectTag': 'Select a tag',
  'today.elapsed': 'elapsed',
  'today.wakeLock': 'Screen stays awake',
  'today.wakeLockAria': 'Screen wake lock active',
  'today.noTagPrompt': 'Select a tag above to start the timer',
  'today.start': 'Start',
  'today.stop': 'Stop',
  'today.recent': 'recent',
  'today.statToday': 'today',
  'today.statTagTotal': 'tag total',
  'today.statAllTime': 'all time',
  'today.statStarted': 'started',
  'today.statStopped': 'stopped',
  'today.statRemaining': 'remaining',
  'today.sessions': 'Sessions',
  'today.offline': 'Offline — will sync automatically when back online',

  // tags
  'tags.eyebrow': 'tags',
  'tags.newTag': 'New tag',
  'tags.loadError': 'Failed to load tags.',
  'tags.empty': 'No tags.',
  'tags.editTag': 'edit tag',
  'tags.parentTag': 'PARENT TAG',
  'tags.dupName': 'A tag with the same name exists at this level (saving is allowed)',
  'tags.discardConfirm': 'Delete the "{name}" tag? Its child tags and records are kept.',
  'tags.discardFail': 'Failed to delete.',
  'tags.namePlaceholder': 'Tag name',
  'tags.dupShort': 'Duplicate',
  'tags.addChildTitle': 'Add child tag',
  'tags.editTitle': 'Edit',

  // tag picker
  'tagPicker.root': 'tags',
  'tagPicker.empty': 'No tags',
  'tagPicker.selectAria': 'Select {name} tag',

  // logs
  'logs.eyebrow': 'logs',
  'logs.tabDaily': 'Daily',
  'logs.tabWeekly': 'Weekly',
  'logs.tabMonthly': 'Monthly',
  'logs.tabTag': 'By tag',
  'logs.total': 'total',
  'logs.noRecords': 'No records',
  'logs.sessions': 'sessions',
  'logs.loadFail': 'Failed to load.',
  'logs.sessionCount': '{n} sessions',
  'logs.weekTotal': 'WEEK TOTAL',
  'logs.dailyAvg': 'DAILY AVG',
  'logs.monthTotal': 'MONTH TOTAL',
  'logs.tagTotal': 'TOTAL',
  'logs.selectTag': 'Select a tag',
  'logs.selectTagStats': 'Select a tag to see statistics',
  'logs.noRecordsPeriod': 'No records in this period',
  'logs.periodWeek': 'This week',
  'logs.periodMonth': 'This month',
  'logs.periodCustom': 'Custom',
  'logs.vsPrev': 'vs prev',
  'logs.dayTooltip': 'Day {day}: {dur}',

  // records
  'records.tagLabel': 'tag',
  'records.title': 'Sessions',
  'records.loadFail': 'Failed to load records.',
  'records.empty': 'No records.',
  'records.deleted': 'Deleted',

  // fields (shared form labels)
  'field.name': 'NAME',
  'field.tag': 'TAG',
  'field.start': 'START',
  'field.end': 'END',

  // add / edit record
  'addRecord.title': 'add session',
  'addRecord.forceOverwrite': 'Force overwrite overlapping sessions',
  'addRecord.selectTagError': 'Please select a tag.',
  'editRecord.title': 'edit session',
  'editRecord.selectTag': 'Select tag',

  // profile
  'profile.loadFail': 'Failed to load profile.',
  'profile.pwMismatch': 'New passwords do not match.',
  'profile.deleteConfirm': 'Deleting your account erases all data. Delete anyway?',
  'profile.deleteFail': 'Failed to delete account.',
  'profile.account': 'account',
  'profile.email': 'email',
  'profile.provider': 'provider',
  'profile.timezone': 'timezone',
  'profile.settings': 'settings',
  'profile.theme': 'THEME',
  'profile.themeAria': 'Theme',
  'profile.dark': 'Dark',
  'profile.light': 'Light',
  'profile.dailyResetHour': 'DAILY RESET HOUR',
  'profile.resetHint': "Today's stats reset at {time}",
  'profile.currentPw': 'CURRENT PASSWORD',
  'profile.currentPwPlaceholder': 'Current password',
  'profile.newPw': 'NEW PASSWORD',
  'profile.newPwPlaceholder': 'New password (only when changing)',
  'profile.confirmPw': 'CONFIRM PASSWORD',
  'profile.confirmPwPlaceholder': 'Confirm new password',
  'profile.googleNoPw': 'Password change is not available for Google accounts',
  'profile.saved': 'Saved',
  'profile.saveChanges': 'Save changes',
  'profile.signOut': 'Sign out',
  'profile.deleteAccount': 'Delete account',
  'profile.uiLanguage': 'Language',
  'profile.uiLanguageHint': 'Choose the display language for the app.',
} as const

export default en
export type MessageKey = keyof typeof en
export type Messages = Record<MessageKey, string>
