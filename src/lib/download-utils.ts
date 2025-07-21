import JSZip from 'jszip';
import type { Memo, Folder } from '@/types';
import { getDownloadFileName } from './memo-utils';

export function downloadTextFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}

export function downloadMemo(memo: Memo): void {
  const filename = getDownloadFileName(memo);
  downloadTextFile(memo.content, filename);
}

export async function downloadAllMemos(
  memos: Memo[], 
  folders: Folder[],
  mode: string
): Promise<void> {
  const zip = new JSZip();
  
  if (mode === '일반') {
    // Create folder structure for general mode
    const folderMap = new Map<string, JSZip>();
    folderMap.set('root', zip);
    
    // Create folders
    folders.forEach(folder => {
      const parentFolder = folder.parentId ? folderMap.get(folder.parentId) : zip;
      if (parentFolder) {
        const newFolder = parentFolder.folder(folder.name);
        if (newFolder) {
          folderMap.set(folder.id, newFolder);
        }
      }
    });
    
    // Add memos to appropriate folders
    memos.forEach(memo => {
      if (memo.mode === '일반') {
        const targetFolder = memo.folderId ? folderMap.get(memo.folderId) : zip;
        if (targetFolder) {
          const filename = getDownloadFileName(memo);
          targetFolder.file(filename, memo.content);
        }
      }
    });
  } else if (mode === '학생') {
    // Group by grade for student mode
    const gradeGroups = new Map<string, Memo[]>();
    
    memos.forEach(memo => {
      if (memo.mode === '학생') {
        const grade = memo.grade;
        if (!gradeGroups.has(grade)) {
          gradeGroups.set(grade, []);
        }
        gradeGroups.get(grade)?.push(memo);
      }
    });
    
    gradeGroups.forEach((gradeMemos, grade) => {
      const gradeFolder = zip.folder(grade);
      if (gradeFolder) {
        gradeMemos.forEach(memo => {
          const filename = getDownloadFileName(memo);
          gradeFolder.file(filename, memo.content);
        });
      }
    });
  } else if (mode === '교사') {
    // Group by year > grade > subject for teacher mode
    const yearGroups = new Map<number, Map<string, Map<string, Memo[]>>>();
    
    memos.forEach(memo => {
      if (memo.mode === '교사') {
        const { year, grade, subject } = memo;
        
        if (!yearGroups.has(year)) {
          yearGroups.set(year, new Map());
        }
        
        const gradeMap = yearGroups.get(year)!;
        if (!gradeMap.has(grade)) {
          gradeMap.set(grade, new Map());
        }
        
        const subjectMap = gradeMap.get(grade)!;
        if (!subjectMap.has(subject)) {
          subjectMap.set(subject, []);
        }
        
        subjectMap.get(subject)?.push(memo);
      }
    });
    
    yearGroups.forEach((gradeMap, year) => {
      const yearFolder = zip.folder(year.toString());
      if (yearFolder) {
        gradeMap.forEach((subjectMap, grade) => {
          const gradeFolder = yearFolder.folder(grade);
          if (gradeFolder) {
            subjectMap.forEach((subjectMemos, subject) => {
              const subjectFolder = gradeFolder.folder(subject);
              if (subjectFolder) {
                subjectMemos.forEach(memo => {
                  const filename = getDownloadFileName(memo);
                  subjectFolder.file(filename, memo.content);
                });
              }
            });
          }
        });
      }
    });
  }
  
  // Generate and download the zip file
  const content = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(content);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = 'nice-notes-backup.zip';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}
