/********************************************************************************
 * 
 * Copyright (c) 2020 EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/
import {injectable, inject} from "inversify";
import {FrontendApplicationContribution} from "@theia/core/lib/browser";
import * as $ from "jquery";

import {FileSystemWatcher} from '@theia/filesystem/lib/browser/filesystem-watcher';
import URI from "@theia/core/lib/common/uri";
import {WorkspaceService} from '@theia/workspace/lib/browser';
const fs = require('fs');


export const AssistanceCommand = {
    id: 'Assistance.command',
    label: "assistance"
};

@injectable()
export class markingElements implements FrontendApplicationContribution {


    idList: Array<string> = [];
    currentHint: number = -1;
    observer: MutationObserver | null;
    leftPostion: number;
    topPosition: number;

    constructor(

        @inject(FileSystemWatcher) private readonly fileSystemWatcher: FileSystemWatcher,
        @inject(WorkspaceService) private readonly workspaceService: WorkspaceService
    ) { }

    findNewCurrent = () => {
        for (let i = 0; i < this.idList.length; i++) {
            let tmp = this.idList[i];
            if ($(this.asId(this.idList[i]) + ":visible").length ||
                ($("div" + ":visible")
                    .filter(function () {return $(this).children().length === 0 && $(this).text() === tmp;})
                    .parent().length > 0)) {
                this.currentHint = i;
                this.currentLeftPosition();
                this.currentTopPosition();
            }
        }
    }

    asId = (id: string) => {
        return "#" + $.escapeSelector(id);
    }

    asContent = (content: string) => {
        return 'div:contains(' + content + ')';
    }

    markCurrent = () => {
        $('body').append('<span id="pointer" style=\"color:yellow;\" >&#8592;</span>');
        $("#pointer").css({"left": this.currentLeftPosition(), "top": this.currentTopPosition(), "position": "absolute", "z-index": "1000"});
    }

    currentLeftPosition = () => {
        if ($(this.asId(this.idList[this.currentHint])).length) {
            this.leftPostion = $(this.asId(this.idList[this.currentHint]))[0].getBoundingClientRect().right + $(window)['scrollLeft']()!;
        } else {
            let tmp = this.idList[this.currentHint];
            this.leftPostion = $("div" + ":visible")
                .filter(function () {return $(this).children().length === 0 && $(this).text() === tmp;})
                .parent()[0].getBoundingClientRect().right + $(window)['scrollLeft']()!;
        }
        return this.leftPostion;
    }

    currentTopPosition = () => {
        if ($(this.asId(this.idList[this.currentHint])).length) {
            this.topPosition = $(this.asId(this.idList[this.currentHint]))[0].getBoundingClientRect().top + $(window)['scrollTop']()!;
        } else {
            let tmp = this.idList[this.currentHint];
            this.topPosition = $("div" + ":visible")
                .filter(function () {return $(this).children().length === 0 && $(this).text() === tmp;})
                .parent()[0].getBoundingClientRect().top + $(window)['scrollTop']()!;
        }
        return this.topPosition;
    }

    finishAssistance = () => {

        if (this.observer != undefined) {
            this.observer.disconnect();
            this.observer = null;
        }

        MutationObserver = window.MutationObserver;
        let observer = new MutationObserver(() => {

            let oldHint = this.currentHint;
            let oldTop = this.topPosition;
            let oldLeft = this.leftPostion;
            this.findNewCurrent();
            if (oldHint == this.currentHint) {
                if (oldTop != this.topPosition || oldLeft != this.leftPostion) {
                    this.markCurrent();
                }
            } else {
                this.cleanUp();
                observer.disconnect();
            }
        });

        observer.observe(document, {
            subtree: true, childList: true
        });

        setTimeout(() => {
            this.cleanUp();
        }, 5000);
    }

    cleanUp = () => {
        $("#pointer").remove();
        this.currentHint = -1;
        this.topPosition = -1;
        this.leftPostion = -1;
    }

    prepareNextStep = () => {
        if (this.observer != undefined) {
            this.observer.disconnect();
            this.observer = null;
        }
        MutationObserver = window.MutationObserver;
        this.observer = new MutationObserver(() => {
            this.observe();
        });

        this.observer.observe(document, {
            subtree: true, childList: true
        });
    }


    observe = () => {
        let oldHint = this.currentHint;
        let oldTop = this.topPosition;
        let oldLeft = this.leftPostion;
        this.findNewCurrent();
        if (oldHint != this.currentHint || oldTop != this.topPosition || oldLeft != this.leftPostion) {
            this.markCurrent();
            if (this.currentHint + 1 == this.idList.length) {
                this.finishAssistance();
            } else {
                this.prepareNextStep();
            }
        }
    }

    initialize() {

        this.workspaceService.recentWorkspaces().then(res => {
            let uri = new URI(res[0] + "/.tutorial/assistance.json");
            this.fileSystemWatcher.onFilesChanged;


            fs.watchFile(uri.toString(), {
                bigint: false,
                persistent: true,
                interval: 2000,
            },
                () => {
                    fs.readFile(uri, "utf8").then((fileText: string) => {

                        this.idList = JSON.parse(fileText);

                        this.observe();
                    });
                });

            /*this.fileService.onDidFilesChange(event => {
                if (event.contains(uri)) {
                    this.fileService.read(uri).then((fileText) => {

                        this.idList = JSON.parse(fileText.value)

                        this.observe();
                    })
                }
            });
            this.fileService.watch(uri);
            */
        });
    }
}
