import {createContext,useCallback,useContext,useEffect,useMemo,useState,type ReactNode} from 'react';
import english from './locales/en.json';
import campusEnglish from './locales/campus.en.json';

export type Language='zh'|'en';
type Values=Record<string,string|number|undefined>;
const dictionary:Record<string,string>={...english,...campusEnglish};
const reverse=Object.fromEntries(Object.entries(dictionary).map(([zh,en])=>[en,zh]));
const storageKey='student-workbench-language';
export function readLanguage():Language {
  try {
    // One-time migration to the English demo requested by the project owner.
    if(localStorage.getItem('workbench-language-default-v2')!=='1'){
      localStorage.setItem('workbench-language-default-v2','1');localStorage.setItem(storageKey,'en');return 'en';
    }
    return localStorage.getItem(storageKey)==='zh'?'zh':'en';
  }catch{return 'en';}
}
export function translate(message:string,language:Language,values:Values={}):string {
  const canonical=Object.hasOwn(reverse,message)?reverse[message]:message;
  const status=message.match(/^模型服务返回 (\d+)。请核对接口权限、模型名称或额度；本次没有生成 AI 答案。$/);
  if(language==='en'&&status)return dictionary['模型服务返回 {status}。请核对接口权限、模型名称或额度；本次没有生成 AI 答案。'].replace('{status}',status[1]);
  const template=language==='en'?(Object.hasOwn(dictionary,canonical)?dictionary[canonical]:message):canonical;
  return template.replace(/\{(\w+)\}/g,(token,key)=>!Object.hasOwn(values,key)||values[key]===undefined?token:String(values[key]));
}
type I18n={language:Language;locale:string;t:(message:string,values?:Values)=>string;setLanguage:(language:Language)=>void};
const Context=createContext<I18n|null>(null);
export function I18nProvider({children}:{children:ReactNode}) {
  const [language,setLanguage]=useState<Language>(readLanguage);
  useEffect(()=>{try{localStorage.setItem(storageKey,language);}catch{}document.documentElement.lang=language==='en'?'en':'zh-CN';},[language]);
  const t=useCallback((message:string,values?:Values)=>translate(message,language,values),[language]);
  const value=useMemo(()=>({language,locale:language==='en'?'en-GB':'zh-CN',t,setLanguage}),[language,t]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useI18n():I18n {const value=useContext(Context);if(!value)throw new Error('I18nProvider is missing');return value;}
export function LanguageSwitcher(){const {language,setLanguage,t}=useI18n();return <div className="language-switcher" role="group" aria-label="Language / 语言"><button type="button" onClick={()=>setLanguage('zh')} aria-pressed={language==='zh'} aria-label={t('切换为中文')}>中文</button><button type="button" onClick={()=>setLanguage('en')} aria-pressed={language==='en'} aria-label={t('切换为英文')}>EN</button></div>;}
