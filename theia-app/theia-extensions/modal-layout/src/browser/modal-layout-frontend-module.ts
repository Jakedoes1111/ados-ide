/********************************************************************************
 * Copyright (C) 2026 aDOs IDE contributors and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import { FrontendApplicationContribution, KeybindingContribution } from '@theia/core/lib/browser';
import { CommandContribution } from '@theia/core/lib/common';
import { ContainerModule } from '@theia/core/shared/inversify';
import { ModalLayoutContribution } from './modal-layout-contribution';

export default new ContainerModule(bind => {
    bind(ModalLayoutContribution).toSelf().inSingletonScope();
    bind(FrontendApplicationContribution).toService(ModalLayoutContribution);
    bind(CommandContribution).toService(ModalLayoutContribution);
    bind(KeybindingContribution).toService(ModalLayoutContribution);
});
