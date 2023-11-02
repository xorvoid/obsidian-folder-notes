import { App, TFolder, Menu, TAbstractFile, Notice, TFile, Editor, MarkdownView, Platform, stringifyYaml } from 'obsidian';
import FolderNotesPlugin from './main';
import { getFolderNote, createFolderNote, deleteFolderNote, turnIntoFolderNote, openFolderNote, extractFolderName } from './functions/folderNoteFunctions';
import { ExcludedFolder } from './excludedFolder';
export class Commands {
	plugin: FolderNotesPlugin;
	app: App;
	constructor(app: App, plugin: FolderNotesPlugin) {
		this.plugin = plugin;
		this.app = app;
	}
	registerCommands() {
		this.editorCommands();
		this.fileCommands();
		this.regularCommands();
	}
	regularCommands() {
		this.plugin.addCommand({
			id: 'turn-into-folder-note',
			name: 'Make current active note a folder note for the folder of the active note',
			callback: () => {
				const file = this.app.workspace.getActiveFile();
				if (!(file instanceof TFile)) return;
				const folder = file.parent;
				if (!(folder instanceof TFolder)) return;
				const folderNote = getFolderNote(this.plugin, folder.path);
				turnIntoFolderNote(this.plugin, file, folder, folderNote);
			}
		});
		this.plugin.addCommand({
			id: 'create-folder-note',
			name: 'Create folder note with a new folder for the active note in the current folder',
			callback: async () => {
				const file = this.app.workspace.getActiveFile();
				if (!(file instanceof TFile)) return;
				let newPath = file.parent?.path + '/' + file.basename;
				if (file.parent?.path === '' || file.parent?.path === '/') {
					newPath = file.basename;
				}
				if (this.plugin.app.vault.getAbstractFileByPath(newPath)) {
					return new Notice('Folder already exists');
				}
				const automaticallyCreateFolderNote = this.plugin.settings.autoCreate;
				this.plugin.settings.autoCreate = false;
				this.plugin.saveSettings();
				await this.plugin.app.vault.createFolder(newPath);
				const folder = this.plugin.app.vault.getAbstractFileByPath(newPath);
				if (!(folder instanceof TFolder)) return;
				createFolderNote(this.plugin, folder.path, true, '.' + file.extension, false, file);
				this.plugin.settings.autoCreate = automaticallyCreateFolderNote;
				this.plugin.saveSettings();
			}
		})
		this.plugin.addCommand({
			id: 'create-folder-note-for-current-folder',
			name: 'Create folder note for current folder of active note',
			callback: () => {
				const file = this.app.workspace.getActiveFile();
				if (!(file instanceof TFile)) return;
				const folder = file.parent;
				if (!(folder instanceof TFolder)) return;
				createFolderNote(this.plugin, folder.path, true, undefined, false);
			}
		});
		this.plugin.addCommand({
			id: 'delete-folder-note-for-current-folder',
			name: 'Delete folder note of current folder of active note',
			callback: () => {
				const file = this.app.workspace.getActiveFile();
				if (!(file instanceof TFile)) return;
				const folder = file.parent;
				if (!(folder instanceof TFolder)) return;
				const folderNote = getFolderNote(this.plugin, folder.path);
				if (!(folderNote instanceof TFile)) return;
				deleteFolderNote(this.plugin, folderNote);
			}
		});
		this.plugin.addCommand({
			id: 'open-folder-note-for-current-folder',
			name: 'Open folder note of current folder of active note',
			callback: () => {
				const file = this.app.workspace.getActiveFile();
				if (!(file instanceof TFile)) return;
				const folder = file.parent;
				if (!(folder instanceof TFolder)) return;
				const folderNote = getFolderNote(this.plugin, folder.path);
				if (!(folderNote instanceof TFile)) return;
				openFolderNote(this.plugin, folderNote);
			}
		});
		this.plugin.addCommand({
			id: 'insert-folder-overview-fn',
			name: 'Insert folder overview',
			editorCheckCallback: (checking: boolean, editor: Editor) => {
				const line = editor.getCursor().line;
				const lineText = editor.getLine(line);
				if (lineText.trim() === '' || lineText.trim() === '>') {
					if (!checking) {
						let json = Object.assign({}, this.plugin.settings.defaultOverview);
						json.id = crypto.randomUUID();
						const yaml = stringifyYaml(json)
						if (lineText.trim() === '') {
							editor.replaceSelection(`\`\`\`folder-overview\n${yaml}\`\`\`\n`);
						} else if (lineText.trim() === '>') {
							// add > to the beginning of each line
							const lines = yaml.split('\n');
							const newLines = lines.map((line) => {
								return `> ${line}`;
							});
							editor.replaceSelection(`\`\`\`folder-overview\n${newLines.join('\n')}\`\`\`\n`);
						}
					}
					return true;
				}
				return false;
			},
		})
		this.plugin.addCommand({
			id: 'create-folder-note-from-selected-text',
			name: 'Create folder note from selected text',
			editorCheckCallback: (checking: boolean, editor: Editor, view: MarkdownView) => {
				const text = editor.getSelection().trim();
				const line = editor.getCursor().line;
				const file = view.file;
				if (!(file instanceof TFile)) return false;
				if (text && text.trim() !== '') {
					if (checking) { return true; }
					const blacklist = ['*', '\\', '"', '/', '<', '>', '?', '|', ':'];
					for (const char of blacklist) {
						if (text.includes(char)) {
							new Notice('File name cannot contain any of the following characters: * " \\ / < > : | ?');
							return false;
						}
					}
					if (text.endsWith('.')) {
						new Notice('File name cannot end with a dot');
						return;
					}
					let folder: TAbstractFile | null;
					const folderPath = this.plugin.getFolderPathFromString(file.path);
					if (folderPath === '') {
						folder = this.plugin.app.vault.getAbstractFileByPath(text);
						if (folder instanceof TFolder) {
							new Notice('Folder note already exists');
							return false;
						} else {
							this.plugin.app.vault.createFolder(text);
							createFolderNote(this.plugin, text, false);
						}
					} else {
						folder = this.plugin.app.vault.getAbstractFileByPath(folderPath + '/' + text);
						if (folder instanceof TFolder) {
							new Notice('Folder note already exists');
							return false;
						}
						if (this.plugin.settings.storageLocation === 'parentFolder') {
							if (this.app.vault.getAbstractFileByPath(folderPath + '/' + text + this.plugin.settings.folderNoteType)) {
								new Notice('File already exists');
								return false;
							}
						}
						this.plugin.app.vault.createFolder(folderPath + '/' + text);
						createFolderNote(this.plugin, folderPath + '/' + text, false);
					}
					const fileName = this.plugin.settings.folderNoteName.replace('{{folder_name}}', text);
					if (fileName !== text) {
						editor.replaceSelection(`[[${fileName}]]`);
					} else {
						editor.replaceSelection(`[[${fileName}|${text}]]`);
					}
					return true;
				}
				return false;
			},
		})
	}
	fileCommands() {
		this.plugin.registerEvent(this.app.workspace.on('file-menu', (menu: Menu, file: TAbstractFile) => {
			let folder: TAbstractFile | TFolder | null = file.parent;
			if (file instanceof TFile) {
				if (this.plugin.settings.storageLocation === 'insideFolder') {
					folder = file.parent;
				} else {
					const fileName = extractFolderName(this.plugin.settings.folderNoteName, file.basename);
					if (fileName) {
						if (file.parent?.path === '' || file.parent?.path === '/') {
							folder = this.plugin.app.vault.getAbstractFileByPath(fileName);
						} else {
							folder = this.plugin.app.vault.getAbstractFileByPath(file.parent?.path + '/' + fileName);
						}
					}
				}
				if (folder instanceof TFolder) {
					const folderNote = getFolderNote(this.plugin, folder.path);
					if (folderNote?.path === file.path) { return; }
				} else if (file.parent instanceof TFolder) {
					folder = file.parent;
				}
			}
			menu.addItem((item) => {
				if (Platform.isDesktop && !Platform.isTablet && this.plugin.settings.useSubmenus) {
					item
						.setTitle('Folder Note Commands')
						.setIcon('folder-edit');
				}
				let subMenu: Menu;
				if (!Platform.isDesktopApp || !Platform.isDesktop || Platform.isTablet || !this.plugin.settings.useSubmenus) {
					subMenu = menu;
					item.setDisabled(true);
				} else {
					// @ts-ignore
					subMenu = item.setSubmenu() as Menu;
				}
				if (file instanceof TFile) {
					// @ts-ignore
					subMenu.addItem((item) => {
						item.setTitle('Create folder note')
							.setIcon('edit')
							.onClick(async () => {
								if (!folder) return;
								let newPath = folder.path + '/' + file.basename;
								if (folder.path === '' || folder.path === '/') {
									newPath = file.basename;
								}
								if (this.plugin.app.vault.getAbstractFileByPath(newPath)) {
									return new Notice('Folder already exists');
								}
								const automaticallyCreateFolderNote = this.plugin.settings.autoCreate;
								this.plugin.settings.autoCreate = false;
								this.plugin.saveSettings();
								await this.plugin.app.vault.createFolder(newPath);
								const newFolder = this.plugin.app.vault.getAbstractFileByPath(newPath);
								if (!(newFolder instanceof TFolder)) return;
								await createFolderNote(this.plugin, newFolder.path, true, '.' + file.extension, false, file);
								this.plugin.settings.autoCreate = automaticallyCreateFolderNote;
								this.plugin.saveSettings();
							});
					});
					if (this.plugin.getFolderPathFromString(file.path) === '') return;
					if (!(folder instanceof TFolder)) return;
					subMenu.addItem((item) => {
						item.setTitle('Turn into folder note')
							.setIcon('edit')
							.onClick(() => {
								if (!folder || !(folder instanceof TFolder)) return;
								const folderNote = getFolderNote(this.plugin, folder.path);
								turnIntoFolderNote(this.plugin, file, folder, folderNote);
							});
					});
				}
				if (!(file instanceof TFolder)) return;
				if (this.plugin.settings.excludeFolders.find((folder) => folder.path === file.path)) {
					subMenu.addItem((item) => {
						item.setTitle('Remove folder from excluded folders')
							.setIcon('trash')
							.onClick(() => {
								this.plugin.settings.excludeFolders = this.plugin.settings.excludeFolders.filter(
									(folder) => folder.path !== file.path);
								this.plugin.saveSettings();
								new Notice('Successfully removed folder from excluded folders');
							});
					});
					return;
				}
				subMenu.addItem((item) => {
					item.setTitle('Exclude folder from folder notes')
						.setIcon('x-circle')
						.onClick(() => {
							const excludedFolder = new ExcludedFolder(file.path, this.plugin.settings.excludeFolders.length);
							this.plugin.settings.excludeFolders.push(excludedFolder);
							this.plugin.saveSettings();
							new Notice('Successfully excluded folder from folder notes');
						});
				});
				if (!(file instanceof TFolder)) return;
				const folderNote = getFolderNote(this.plugin, file.path);
				if (folderNote instanceof TFile) {
					subMenu.addItem((item) => {
						item.setTitle('Delete folder note')
							.setIcon('trash')
							.onClick(() => {
								deleteFolderNote(this.plugin, folderNote);
							});
					});
					subMenu.addItem((item) => {
						item.setTitle('Open folder note')
							.setIcon('chevron-right-square')
							.onClick(() => {
								openFolderNote(this.plugin, folderNote);
							});
					});
				} else {
					subMenu.addItem((item) => {
						item.setTitle('Create folder note')
							.setIcon('edit')
							.onClick(() => {
								createFolderNote(this.plugin, file.path, true);
							});
					});
				}
			});
		}));
	}
	editorCommands() {
		this.plugin.registerEvent(this.plugin.app.workspace.on('editor-menu', (menu: Menu, editor: Editor, view: MarkdownView) => {
			const text = editor.getSelection().trim();
			const line = editor.getCursor().line;
			const lineText = editor.getLine(line);
			if (lineText.trim() === '' || lineText.trim() === '>') {
				menu.addItem((item) => {
					item.setTitle('Create folder overview')
						.setIcon('edit')
						.onClick(() => {
							let json = Object.assign({}, this.plugin.settings.defaultOverview);
							json.id = crypto.randomUUID();
							const yaml = stringifyYaml(json)
							if (lineText.trim() === '') {
								editor.replaceSelection(`\`\`\`folder-overview\n${yaml}\`\`\`\n`);
							} else if (lineText.trim() === '>') {
								// add > to the beginning of each line
								const lines = yaml.split('\n');
								const newLines = lines.map((line) => {
									return `> ${line}`;
								});
								editor.replaceSelection(`\`\`\`folder-overview\n${newLines.join('\n')}\`\`\`\n`);
							}
						});
				});
			}
			if (!text || text.trim() === '') return;
			menu.addItem((item) => {
				item.setTitle('Create folder note')
					.setIcon('edit')
					.onClick(() => {
						const file = view.file;
						if (!(file instanceof TFile)) return;
						const blacklist = ['*', '\\', '"', '/', '<', '>', '?', '|', ':'];
						for (const char of blacklist) {
							if (text.includes(char)) {
								new Notice('File name cannot contain any of the following characters: * " \\ / < > : | ?');
								return;
							}
						}
						if (text.endsWith('.')) {
							new Notice('File name cannot end with a dot');
							return;
						}
						let folder: TAbstractFile | null;
						const folderPath = this.plugin.getFolderPathFromString(file.path);
						const fileName = this.plugin.settings.folderNoteName.replace('{{folder_name}}', text);
						if (folderPath === '') {
							folder = this.plugin.app.vault.getAbstractFileByPath(text);
							if (folder instanceof TFolder) {
								return new Notice('Folder note already exists');
							} else {
								this.plugin.app.vault.createFolder(text);
								createFolderNote(this.plugin, text, false);
							}
						} else {
							folder = this.plugin.app.vault.getAbstractFileByPath(folderPath + '/' + text);
							if (folder instanceof TFolder) {
								return new Notice('Folder note already exists');
							}
							if (this.plugin.settings.storageLocation === 'parentFolder') {
								if (this.app.vault.getAbstractFileByPath(folderPath + '/' + fileName + this.plugin.settings.folderNoteType)) {
									return new Notice('File already exists');
								}
							}
							this.plugin.app.vault.createFolder(folderPath + '/' + text);
							createFolderNote(this.plugin, folderPath + '/' + text, false);
						}
						if (fileName !== text) {
							editor.replaceSelection(`[[${fileName}]]`);
						} else {
							editor.replaceSelection(`[[${fileName}|${text}]]`);
						}
					});
			});
		}));
	}
}
