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
import { VoiceSessionService } from '../common/voice-session-service';
import { VoiceContribution } from './voice-contribution';
import { VoiceFrontendService } from './voice-frontend-service';

export default new ContainerModule(bind => {
    bind(VoiceFrontendService).toSelf().inSingletonScope();
    bind(VoiceSessionService).toService(VoiceFrontendService);
    bind(FrontendApplicationContribution).toService(VoiceFrontendService);

    bind(VoiceContribution).toSelf().inSingletonScope();
    bind(CommandContribution).toService(VoiceContribution);
    bind(KeybindingContribution).toService(VoiceContribution);
});

