import { team, ME_ID, saveOrg, subtreeIds, orgMembers } from './data.js';

const byId = (id) => team.find((p) => p.id === id);
const inOrg = (id) => orgMembers().some((p) => p.id === id);

export class OrgError extends Error {}
const need = (cond, message) => {
  if (!cond) throw new OrgError(message);
};

// People from the general list who are not currently part of the org.
export function pool() {
  const used = new Set(orgMembers().map((p) => p.id));
  return team
    .filter((p) => !used.has(p.id))
    .map((p) => ({ id: p.id, fullName: p.fullName, role: p.role, city: p.city }));
}

function checkPlacement(personId, managerId) {
  need(byId(personId), 'האדם לא קיים');
  need(personId !== ME_ID, 'אי אפשר להזיז את ראש הארגון');
  need(inOrg(managerId), 'המנהל שנבחר לא נמצא בארגון');
  need(!subtreeIds(personId).includes(managerId), 'אי אפשר להעביר אדם אל תחת עצמו או אל תחת מישהו מהצוות שלו');
}

// Add someone from the pool, or move someone already in the org.
export function placePerson(personId, managerId) {
  checkPlacement(personId, managerId);
  byId(personId).managerId = managerId;
  saveOrg();
}

// Remove from the org. Direct reports move up to the removed person's manager, so nobody gets lost.
export function removePerson(personId) {
  need(personId !== ME_ID, 'אי אפשר להסיר את ראש הארגון');
  need(inOrg(personId), 'האדם לא נמצא בארגון');
  const person = byId(personId);
  for (const p of team) if (p.managerId === personId) p.managerId = person.managerId;
  person.managerId = null;
  person.teamName = null;
  saveOrg();
}

export function renameTeam(leadId, teamName) {
  need(inOrg(leadId), 'האדם לא נמצא בארגון');
  byId(leadId).teamName = String(teamName ?? '').trim().slice(0, 60) || null;
  saveOrg();
}

export function createTeam({ name, leadId, parentId, memberIds }) {
  const teamName = String(name ?? '').trim().slice(0, 60);
  const members = Array.isArray(memberIds) ? [...new Set(memberIds)] : [];
  need(teamName, 'חסר שם לצוות');
  need(byId(leadId), 'צריך לבחור ראש צוות');
  need(members.length, 'צריך לבחור לפחות חבר צוות אחד');
  need(!members.includes(leadId), 'ראש הצוות לא יכול להיות גם חבר בו');
  need(!members.includes(ME_ID), 'אי אפשר להזיז את ראש הארגון');
  need(members.every(byId), 'אחד מחברי הצוות לא קיים');

  // Validate everything before changing anything.
  if (leadId !== ME_ID) checkPlacement(leadId, parentId);
  else need(false, 'ראש הארגון כבר מנהל את הארגון כולו');
  const above = new Set();
  for (let id = parentId; id; id = byId(id)?.managerId) above.add(id);
  need(!members.some((m) => above.has(m)), 'חבר צוות לא יכול להיות מעל ראש הצוות בהיררכיה');

  const lead = byId(leadId);
  lead.managerId = parentId;
  lead.teamName = teamName;
  for (const id of members) byId(id).managerId = leadId;
  saveOrg();
}
