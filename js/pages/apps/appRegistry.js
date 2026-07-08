/**
 * appRegistry.js
 * Fait le lien entre un module (ligne de la table `modules`, ex: 'members')
 * et l'écran JS correspondant. Le bureau et le menu démarrer n'affichent
 * que les modules pour lesquels le membre a la permission 'view' (grade OU
 * fonctions cumulées), ou qui sont marqués "communs" (voir permissionsService.js).
 */
import { mountMembersApp } from './members.js';
import { mountTreasuryApp } from './treasury.js';
import { mountArmoryApp } from './armory.js';
import { mountTrainingsApp } from './trainings.js';
import { mountPlanningApp } from './planning.js';
import { mountRelationsApp } from './relations.js';
import { mountSettingsApp } from './settings.js';
import { mountDashboardApp } from './dashboard.js';
import { mountProfileApp } from './profile.js';
import { mountBarApp } from './bar.js';
import { mountMecanoApp } from './mecano.js';
import { mountMeetingReportsApp } from './meetingReports.js';
import { mountNotepadApp } from './notepad.js';

export const APP_REGISTRY = {
    dashboard: { mount: (el) => mountDashboardApp(el), width: 820, height: 560 },
    profile:    { mount: (el) => mountProfileApp(el), width: 700, height: 560 },
    members:     { mount: (el) => mountMembersApp(el), width: 900, height: 560 },
    treasury:     { mount: (el, profile) => mountTreasuryApp(el, profile), width: 820, height: 560 },
    stock:         { mount: (el, profile) => mountTreasuryApp(el, profile), width: 820, height: 560 }, // même app, onglet Stocks
    armory:         { mount: (el) => mountArmoryApp(el), width: 860, height: 560 },
    trainings:       { mount: (el) => mountTrainingsApp(el), width: 820, height: 560 },
    planning:         { mount: (el) => mountPlanningApp(el), width: 780, height: 600 },
    relations:         { mount: (el) => mountRelationsApp(el), width: 800, height: 560 },
    meetings:           { mount: (el) => mountMeetingReportsApp(el), width: 800, height: 560 },
    notepad:             { mount: (el, profile) => mountNotepadApp(el, profile), width: 700, height: 540 },
    bar:                { mount: (el, profile) => mountBarApp(el, profile), width: 860, height: 580 },
    mecano:              { mount: (el, profile) => mountMecanoApp(el, profile), width: 860, height: 580 },
    settings:             { mount: (el) => mountSettingsApp(el), width: 780, height: 580 },
};
