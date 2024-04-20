import FolderNotesPlugin from 'src/main';
import { Platform, Keymap } from 'obsidian';
import { getFolderNote } from 'src/functions/folderNoteFunctions';
import { handleFolderClick, handleViewHeaderClick } from './handleClick';

export async function addObserver(plugin: FolderNotesPlugin) {
    plugin.observer = new MutationObserver((mutations: MutationRecord[]) => {
        mutations.forEach((rec) => {
            if (rec.type === 'childList') {
                (<Element>rec.target).querySelectorAll('div.nav-folder-title-content')
                    .forEach((element: HTMLElement) => {
                        if (element.onclick) return;
                        if (Platform.isMobile && plugin.settings.disableOpenFolderNoteOnClick) return;
                        // handle middle click
                        element.addEventListener('auxclick', (event: MouseEvent) => {
                            if (event.button == 1) {
                                handleFolderClick(event, plugin)
                            }
                        }, { capture: true });
                        element.onclick = (event: MouseEvent) => handleFolderClick(event, plugin);
                        plugin.registerDomEvent(element, 'pointerover', (event: MouseEvent) => {
                            plugin.hoveredElement = element;
                            plugin.mouseEvent = event;
                            if (!Keymap.isModEvent(event)) return;
                            if (!(event.target instanceof HTMLElement)) return;

                            const folderPath = event?.target?.parentElement?.getAttribute('data-path') || '';
                            const folderNote = getFolderNote(plugin, folderPath);
                            if (!folderNote) return;

                            plugin.app.workspace.trigger('hover-link', {
                                event: event,
                                source: 'preview',
                                hoverParent: {
                                    file: folderNote,
                                },
                                targetEl: event.target,
                                linktext: folderNote?.basename,
                                sourcePath: folderNote?.path,
                            });
                            plugin.hoverLinkTriggered = true;
                        });
                        plugin.registerDomEvent(element, 'pointerout', () => {
                            plugin.hoveredElement = null;
                            plugin.mouseEvent = null;
                            plugin.hoverLinkTriggered = false;
                        });
                    });
                if (!plugin.settings.openFolderNoteOnClickInPath) { return; }
                (<Element>rec.target).querySelectorAll('span.view-header-breadcrumb')
                    .forEach((element: HTMLElement) => {
                        const breadcrumbs = element.parentElement?.querySelectorAll('span.view-header-breadcrumb');
                        if (!breadcrumbs) return;
                        let path = '';
                        breadcrumbs.forEach((breadcrumb: HTMLElement) => {
                            if (breadcrumb.hasAttribute('old-name')) {
                                path += breadcrumb.getAttribute('old-name') + '/';
                            } else {
                                path += breadcrumb.innerText.trim() + '/';
                            }
                            const folderPath = path.slice(0, -1);
                            breadcrumb.setAttribute('data-path', folderPath);
                            const folder = plugin.fmtpHandler?.modifiedFolders.get(folderPath);
                            if (folder && plugin.settings.frontMatterTitle.path && plugin.settings.frontMatterTitle.enabled) {
                                breadcrumb.setAttribute('old-name', folder.name || '');
                                breadcrumb.innerText = folder.newName || '';
                            }
                            const folderNote = getFolderNote(plugin, folderPath);
                            if (folderNote) {
                                breadcrumb.classList.add('has-folder-note');
                            }
                        });
                        element.parentElement?.setAttribute('data-path', path.slice(0, -1));
                        if (breadcrumbs.length > 0) {
                            breadcrumbs.forEach((breadcrumb: HTMLElement) => {
                                if (breadcrumb.onclick) return;
                                breadcrumb.onclick = (event: MouseEvent) => handleViewHeaderClick(event, plugin);

                                // Remove existing event listener(s) for folder note header breadcrumb when open folder in path enabled
                                if (breadcrumb.classList.contains('has-folder-note')) {
                                    const clonedBreadcrumb = breadcrumb.cloneNode(true) as HTMLElement;
                                    breadcrumb.parentElement?.replaceChild(clonedBreadcrumb, breadcrumb);
                                    clonedBreadcrumb.onclick = (event: MouseEvent) => {
                                        if (plugin.settings.openFolderNoteOnClickInPath) {
                                            handleViewHeaderClick(event, plugin);
                                        } else {
                                            // Necessary if open folder in path disabled after breadcrumb rendered
                                            breadcrumb.dispatchEvent(new PointerEvent(event.type, event));
                                        }
                                    }
                                }
                            });
                        }
                    });
            }
        });
    });
}