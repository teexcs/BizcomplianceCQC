/**
 * The evidence rulebook — full inspection breadth.
 *
 * Coverage: the 18 BizCompliance areas PLUS the wider evidence an inspector can
 * ask for — restrictive practice, Reg 9A visiting, Reg 20A rating display,
 * Oliver McGowan training, DSPT/cyber, PEEPs, sexual safety, end-of-life,
 * client money, equipment servicing, and more (~300 signals + extended
 * expectations beyond the core library).
 *
 * DESIGN GUARANTEE — deterministic, no generation:
 * A signal is reported EVIDENCED only when a real line matches a pattern; the
 * line is quoted verbatim with file + line number. Otherwise it is reported
 * NOT FOUND. The engine cannot invent evidence because it never writes any.
 *
 * `weight: 'critical'`  — legal duty / rating-limiting gap.
 * `weight: 'expected'`  — CQC expectation / strong practice.
 */

export const AREA_SIGNALS = {
  /* ======================= 01 Registration & SoP ======================= */
  '01': [
    { id: 'sop-schedule3', label: 'Statement of Purpose covers Schedule 3 required content', weight: 'critical', patterns: [/schedule\s*3/i] },
    { id: 'sop-regulated-activity', label: 'Regulated activity/activities identified', weight: 'critical', patterns: [/regulated activit(y|ies)/i] },
    { id: 'registered-manager', label: 'Registered manager role and responsibilities (Reg 7)', weight: 'critical', patterns: [/registered manager/i] },
    { id: 'registration-regs-2009', label: 'CQC (Registration) Regulations 2009 referenced', weight: 'expected', patterns: [/registration\)? regulations 2009|2009 regulations|registration regs/i] },
    { id: 'sop-28-day-update', label: 'SoP kept under review / changes notified to CQC', weight: 'expected', patterns: [/28 days|kept under review|notify.{0,30}(cqc|commission).{0,30}change|change.{0,30}notif/i] },
    { id: 'aims-objectives', label: 'Aims and objectives of the service stated', weight: 'expected', patterns: [/aims? (and|&) objectives?/i] },
    { id: 'service-user-bands', label: 'Service-user bands / who the service supports', weight: 'expected', patterns: [/service user band|client group|who (we|the service) (support|serve|care for)/i] },
    { id: 'ratings-display', label: 'Reg 20A duty to display CQC rating (incl. website)', weight: 'critical', patterns: [/display.{0,40}rating|rating.{0,40}display|20a/i] },
    { id: 'registration-cert', label: 'Registration certificate display/retention', weight: 'expected', patterns: [/certificate of registration|registration certificate/i] },
    { id: 'rm-absence', label: 'Registered manager absence (28+ days) notification', weight: 'expected', patterns: [/absen(ce|t).{0,40}(28|manager)|manager.{0,40}absen/i] },
    { id: 'fit-proper-directors', label: 'Fit and proper persons: directors (Reg 5) where applicable', weight: 'expected', patterns: [/regulation\s*5\b|fit and proper person.{0,20}director/i] },
  ],

  /* ========================= 02 Safeguarding ========================= */
  '02': [
    { id: 'reg13', label: 'Regulation 13 (safeguarding) referenced', weight: 'critical', patterns: [/regulation\s*13\b|reg\.?\s*13\b/i] },
    { id: 'types-of-abuse', label: 'Types/categories of abuse defined', weight: 'critical', patterns: [/types? of abuse|physical abuse|financial abuse|psychological abuse|sexual abuse|neglect|domestic abuse|modern slavery|self.neglect/i] },
    { id: 'la-referral', label: 'Local authority referral route / s.42 enquiries', weight: 'critical', patterns: [/local authority|safeguarding (team|board|adults board|referral)|section\s*42|s\.?42/i] },
    { id: 'safeguarding-lead', label: 'Named/designated safeguarding lead', weight: 'critical', patterns: [/safeguarding lead|designated safeguarding|designated lead for safeguarding|\bdsl\b|nominated (person|individual|lead)/i] },
    { id: 'whistleblowing', label: 'Whistleblowing route (PIDA) available', weight: 'critical', patterns: [/whistle-?blow|public interest disclosure/i] },
    { id: 'care-act', label: 'Care Act 2014 referenced', weight: 'expected', patterns: [/care act 2014/i] },
    { id: 'immediate-action', label: 'Immediate protection / emergency action steps', weight: 'expected', patterns: [/immediate(ly)? (action|report|protect)|999|emergency services|preserve evidence/i] },
    { id: 'restraint', label: 'Restraint / restrictive practice controls (Reg 13(4)(b))', weight: 'critical', patterns: [/restrain|restrictive (practice|intervention)|physical intervention/i] },
    { id: 'sexual-safety', label: 'Sexual safety addressed', weight: 'expected', patterns: [/sexual safety|sexualised behaviour|sexual relationships? policy/i] },
    { id: 'financial-protection', label: 'Financial abuse protections / money handling controls', weight: 'expected', patterns: [/financial (abuse|protection)|handling (of )?(service user|client).{0,15}money|money handling/i] },
    { id: 'professional-boundaries', label: 'Professional boundaries defined', weight: 'expected', patterns: [/professional boundar/i] },
    { id: 'pipot', label: 'Allegations against staff / PiPoT process', weight: 'expected', patterns: [/allegations? against (staff|people in positions of trust)|pipot|position of trust/i] },
    { id: 'closed-cultures', label: 'Closed-culture risk awareness', weight: 'expected', patterns: [/closed culture/i] },
    { id: 'mash-dbs-referral', label: 'DBS barring referral duty when staff dismissed for harm', weight: 'expected', patterns: [/refer(ral)? to (the )?dbs|barring referral|duty to refer/i] },
  ],

  /* ==================== 03 Consent & Mental Capacity ==================== */
  '03': [
    { id: 'reg11', label: 'Regulation 11 (need for consent) referenced', weight: 'critical', patterns: [/regulation\s*11\b|reg\.?\s*11\b/i] },
    { id: 'mca', label: 'Mental Capacity Act 2005 referenced', weight: 'critical', patterns: [/mental capacity act|mca\b|2005 act/i] },
    { id: 'capacity-assessment', label: 'Two-stage capacity assessment process', weight: 'critical', patterns: [/capacity assessment|assess(ing|ment of)? .{0,20}capacity|two.stage test|two stage test|functional test|diagnostic test/i] },
    { id: 'best-interests', label: 'Best-interests decision process & checklist', weight: 'critical', patterns: [/best.interests?/i] },
    { id: 'capacity-presumption', label: 'Presumption of capacity stated', weight: 'critical', patterns: [/presum(e|ption) .{0,20}capacity|assumed? to have capacity/i] },
    { id: 'unwise-decisions', label: 'Right to make unwise decisions recognised', weight: 'expected', patterns: [/unwise decision/i] },
    { id: 'least-restrictive', label: 'Least-restrictive option principle', weight: 'critical', patterns: [/least restrictive/i] },
    { id: 'dols-lps', label: 'DoLS / LPS route addressed', weight: 'critical', patterns: [/deprivation of liberty|dols|liberty protection safeguards|lps\b/i] },
    { id: 'consent-recorded', label: 'Consent recording requirement', weight: 'critical', patterns: [/record(ing|ed)? .{0,30}consent|consent .{0,30}(record|form)/i] },
    { id: 'lpa-deputy', label: 'LPA / Court-appointed deputy verification', weight: 'expected', patterns: [/lasting power of attorney|lpa\b|court.appointed deputy|court of protection/i] },
    { id: 'advocacy-imca', label: 'Advocacy / IMCA involvement route', weight: 'expected', patterns: [/advoca(te|cy)|imca/i] },
    { id: 'fluctuating', label: 'Fluctuating capacity / decision-specific assessment', weight: 'expected', patterns: [/fluctuat|decision.specific|time.specific/i] },
    { id: 'mha-interface', label: 'Mental Health Act interface (Part 4/4A) where relevant', weight: 'expected', patterns: [/mental health act|1983 act|part 4/i] },
  ],

  /* ==================== 04 Safe Care & Risk Management ==================== */
  '04': [
    { id: 'reg12', label: 'Regulation 12 (safe care and treatment) referenced', weight: 'critical', patterns: [/regulation\s*12\b|reg\.?\s*12\b/i] },
    { id: 'risk-assessment-process', label: 'Individual risk assessment process', weight: 'critical', patterns: [/risk assessment/i] },
    { id: 'risk-mitigation', label: 'Mitigation / control measures required', weight: 'critical', patterns: [/mitigat|control measure|reduce (the )?risk|reasonably practicable/i] },
    { id: 'incident-reporting', label: 'Incident/accident reporting and recording', weight: 'critical', patterns: [/incident (report|form|log)|accident (report|book|form|log)/i] },
    { id: 'lessons-learned', label: 'Learning from incidents / trend analysis', weight: 'critical', patterns: [/lessons? learn|trend|theme|reviewed .{0,40}(pattern|recurring|learning)|log is reviewed/i] },
    { id: 'falls', label: 'Falls risk management', weight: 'expected', patterns: [/falls?\b/i] },
    { id: 'pressure-care', label: 'Pressure damage / skin integrity (e.g. Waterlow)', weight: 'expected', patterns: [/pressure (ulcer|sore|damage|area)|waterlow|skin integrity|tissue viability/i] },
    { id: 'choking-dysphagia', label: 'Choking / dysphagia / IDDSI awareness', weight: 'expected', patterns: [/chok|dysphagia|iddsi|swallow/i] },
    { id: 'moving-handling', label: 'Moving & handling assessments and equipment', weight: 'critical', patterns: [/moving (and|&) handling|manual handling|hoist/i] },
    { id: 'deteriorating-person', label: 'Recognising deterioration (e.g. NEWS2/RESTORE2, sepsis)', weight: 'expected', patterns: [/deteriorat|news\s?2|restore\s?2|sepsis|soft signs/i] },
    { id: 'dnacpr-respect', label: 'DNACPR / ReSPECT handled lawfully', weight: 'expected', patterns: [/dnacpr|do not attempt|respect (form|process)|advance decision/i] },
    { id: 'equipment-servicing', label: 'Equipment maintenance/servicing (LOLER/PUWER)', weight: 'expected', patterns: [/loler|puwer|servic(e|ing).{0,30}equipment|equipment.{0,30}servic/i] },
    { id: 'clinical-tasks', label: 'Delegated healthcare tasks governed (PEG/catheter/insulin)', weight: 'expected', patterns: [/peg feed|catheter|stoma|insulin|delegated (healthcare|clinical)/i] },
    { id: 'missing-person', label: 'Missing person procedure', weight: 'expected', patterns: [/missing person|absconding|fails? to answer/i] },
    { id: 'review-cycle', label: 'Risk review frequency stated', weight: 'critical', patterns: [/review(ed)? (at least |every |annually|monthly|quarterly|[0-9]+ (week|month))|significant change/i] },
  ],

  /* ==================== 05 Lone Working & Staff Safety ==================== */
  '05': [
    { id: 'lone-working-policy', label: 'Lone working arrangements defined', weight: 'critical', patterns: [/lone work/i] },
    { id: 'mhswr', label: 'MHSWR 1999 / HSWA 1974 basis cited', weight: 'expected', patterns: [/management of health (and|&) safety at work|mhswr|health and safety at work .{0,10}act|hswa/i] },
    { id: 'check-in', label: 'Check-in / whereabouts procedure', weight: 'critical', patterns: [/check.?in|buddy system|whereabouts|contact (schedule|procedure|arrangement)/i] },
    { id: 'escalation-lone', label: 'Escalation when a lone worker is unreachable', weight: 'critical', patterns: [/escalat|cannot be (reached|contacted)|fail(ure|s)? to (report|check|return)/i] },
    { id: 'oov-visits-risk', label: 'Environment/home visit risk factors assessed', weight: 'expected', patterns: [/home environment|environment(al)? risk|pets|smoking in the home|aggressi/i] },
    { id: 'travel-risk', label: 'Travel / driving risk (incl. business insurance)', weight: 'expected', patterns: [/travel|driving|vehicle|business (use )?insurance|mot\b/i] },
    { id: 'oot-hours', label: 'Out-of-hours / on-call support for staff', weight: 'expected', patterns: [/out.of.hours|on.call/i] },
    { id: 'violence-aggression', label: 'Violence & aggression toward staff addressed', weight: 'expected', patterns: [/violence|aggression|abusive behaviour toward/i] },
  ],

  /* ======================= 06 Medicines Management ======================= */
  '06': [
    { id: 'reg12g', label: 'Reg 12(2)(g) proper & safe management of medicines', weight: 'critical', patterns: [/12\s*\(\s*2\s*\)\s*\(\s*g\s*\)|proper and safe management of medicines|safe management of medicines|regulation\s*12\b/i] },
    { id: 'mar', label: 'MAR charts required and audited', weight: 'critical', patterns: [/\bmar\b|medicines? administration record|medicine administration record|medication administration record/i] },
    { id: 'nice-ng67', label: 'NICE NG67 / SC1 guidance referenced', weight: 'expected', patterns: [/ng\s?67|sc\s?1\b|nice (guideline|guidance)/i] },
    { id: 'six-rights', label: 'Rights of administration (right person/med/dose/route/time)', weight: 'expected', patterns: [/right (person|medicine|dose|route|time)|6 rights|six rights|5 rights/i] },
    { id: 'prn', label: 'PRN protocols required', weight: 'critical', patterns: [/\bprn\b|when.required medicine/i] },
    { id: 'errors', label: 'Medication error / near-miss procedure', weight: 'critical', patterns: [/medication error|medicine error|near.miss/i] },
    { id: 'controlled-drugs', label: 'Controlled drugs governance (Misuse of Drugs Regs)', weight: 'critical', patterns: [/controlled drug|misuse of drugs/i] },
    { id: 'covert', label: 'Covert administration safeguards (MCA + pharmacist)', weight: 'critical', patterns: [/covert/i] },
    { id: 'self-admin', label: 'Self-administration risk assessment', weight: 'expected', patterns: [/self.administ/i] },
    { id: 'high-risk-meds', label: 'High-risk medicines controls (warfarin/insulin/opioids)', weight: 'expected', patterns: [/warfarin|anticoagulant|insulin|opioid|methotrexate|high.risk medicine/i] },
    { id: 'storage-temp', label: 'Storage / temperature control (incl. fridge lines)', weight: 'expected', patterns: [/storage|refrigerat|fridge|room temperature|cold chain/i] },
    { id: 'disposal', label: 'Safe disposal / returns of medicines', weight: 'expected', patterns: [/disposal|returned? to (the )?pharmac/i] },
    { id: 'reconciliation', label: 'Medicines reconciliation on admission/transfer', weight: 'expected', patterns: [/reconcil/i] },
    { id: 'homely-remedies', label: 'Homely remedies / OTC protocol', weight: 'expected', patterns: [/homely remed|over.the.counter|otc\b/i] },
    { id: 'competency-meds', label: 'Staff medicines competency assessed before administering', weight: 'critical', patterns: [/competenc(y|e|ies).{0,50}(medicin|medication|administer)|(medicin|medication).{0,50}competenc/i] },
    { id: 'time-sensitive', label: 'Time-sensitive medicines (e.g. Parkinson’s) recognised', weight: 'expected', patterns: [/time.(sensitive|critical)|parkinson/i] },
  ],

  /* ================== 07 Person-Centred Care & Planning ================== */
  '07': [
    { id: 'reg9', label: 'Regulation 9 (person-centred care) referenced', weight: 'critical', patterns: [/regulation\s*9\b|reg\.?\s*9\b|person.centred care/i] },
    { id: 'needs-assessment', label: 'Collaborative needs assessment before care starts', weight: 'critical', patterns: [/needs assessment|assessment of .{0,20}needs|pre.admission assessment/i] },
    { id: 'preferences', label: 'Preferences captured and reflected', weight: 'critical', patterns: [/preferences?/i] },
    { id: 'care-plan-review', label: 'Care plan review cycle stated', weight: 'critical', patterns: [/care plan review|review(ed)? .{0,30}care plan|review .{0,20}(monthly|quarterly|annually|every|significant change)/i] },
    { id: 'involvement', label: 'Person/relevant person involved in planning', weight: 'critical', patterns: [/involv(e|ing|ement) .{0,30}(person|service user|client|family|relative|advocate)/i] },
    { id: 'communication-needs', label: 'Communication needs/profile captured (AIS)', weight: 'expected', patterns: [/communication (needs|profile|passport)|accessible information/i] },
    { id: 'nutrition', label: 'Nutrition & hydration needs met (Reg 14, MUST)', weight: 'expected', patterns: [/nutrition|hydration|must\s?(tool|score)|regulation\s*14/i] },
    { id: 'oral-health', label: 'Oral health needs addressed (NICE NG48)', weight: 'expected', patterns: [/oral (health|care)|mouth care|denture/i] },
    { id: 'eol', label: 'End-of-life / advance care planning', weight: 'expected', patterns: [/end of life|palliative|advance care plan|last days of life|gold standards framework/i] },
    { id: 'dementia-pbs', label: 'Dementia / distressed-behaviour (PBS) approach', weight: 'expected', patterns: [/dementia|behaviours? (that challenge|of concern)|positive behaviour support|pbs\b/i] },
    { id: 'visiting-9a', label: 'Reg 9A visiting & accompanying rights (2023 duty)', weight: 'expected', patterns: [/regulation\s*9a|visiting (policy|rights|in care)|right to.{0,20}visit/i] },
    { id: 'daily-records', label: 'Daily care records / contemporaneous notes', weight: 'critical', patterns: [/daily (care )?(notes|records|log)|contemporaneous/i] },
    { id: 'outcomes', label: 'Outcomes / goals tracked for the person', weight: 'expected', patterns: [/outcomes?|goals?/i] },
    { id: 'rsrcrc', label: 'Right Support, Right Care, Right Culture (LD & autism)', weight: 'expected', patterns: [/right support,? right care,? right culture/i] },
  ],

  /* ======================= 08 Complaints & Feedback ======================= */
  '08': [
    { id: 'reg16', label: 'Regulation 16 (complaints) referenced', weight: 'critical', patterns: [/regulation\s*16\b|reg\.?\s*16\b/i] },
    { id: 'complaints-route', label: 'Accessible route to complain described', weight: 'critical', patterns: [/how to (make a )?complain|complaints? (procedure|process|can be made)/i] },
    { id: 'timescales', label: 'Acknowledgement/response timescales stated', weight: 'critical', patterns: [/within \d+ (working |calendar )?days|within \[.{0,20}\] (working )?days|acknowledg|within timescale|same day|response times?|respond(s|ed)? within/i] },
    { id: 'investigation', label: 'Investigation & proportionate action required', weight: 'critical', patterns: [/investigat/i] },
    { id: 'no-detriment', label: 'No detriment / complaints welcomed culture', weight: 'expected', patterns: [/without (fear|detriment|prejudice)|will not affect (the )?care|treated seriously/i] },
    { id: 'ombudsman', label: 'Escalation to LGSCO / Ombudsman signposted', weight: 'critical', patterns: [/ombudsman|lgsco/i] },
    { id: 'cqc-28-day', label: '28-day complaints summary to CQC on request', weight: 'expected', patterns: [/28 days?/i] },
    { id: 'accessible-formats', label: 'Complaints info in accessible formats', weight: 'expected', patterns: [/easy read|large print|accessible format|interpret/i] },
    { id: 'learning-complaints', label: 'Learning from complaints fed into improvement', weight: 'expected', patterns: [/learn(ing)? from complaints|improve.{0,30}complaint|complaint.{0,30}improve/i] },
    { id: 'compliments', label: 'Compliments/feedback also captured', weight: 'expected', patterns: [/compliment|feedback|survey/i] },
  ],

  /* ========================= 09 Duty of Candour ========================= */
  '09': [
    { id: 'reg20', label: 'Regulation 20 (duty of candour) referenced', weight: 'critical', patterns: [/regulation\s*20\b(?!\s*a)|reg\.?\s*20\b(?!\s*a)|duty of candour/i] },
    { id: 'notifiable-incident', label: 'Notifiable safety incident defined', weight: 'critical', patterns: [/notifiable safety incident/i] },
    { id: 'open-transparent', label: 'Open and transparent duty stated', weight: 'critical', patterns: [/open (and|&) (transparent|honest)|open culture|openness and honesty/i] },
    { id: 'apology', label: 'Apology required (and apology ≠ liability)', weight: 'critical', patterns: [/apolog/i] },
    { id: 'true-account', label: 'True account of facts provided', weight: 'expected', patterns: [/true account/i] },
    { id: 'written-record', label: 'Written notification + secure record', weight: 'critical', patterns: [/written (record|notification|account|follow.?up|apolog)|record(ed)? (securely|in writing)|candour record/i] },
    { id: 'reg20-9', label: 'Correct non-NHS threshold (reg 20(9)) applied', weight: 'expected', patterns: [/20\s*\(\s*9\s*\)/] },
    { id: 'support-offered', label: 'Reasonable support offered to the relevant person', weight: 'expected', patterns: [/reasonable support|support .{0,30}(relevant person|family)/i] },
  ],

  /* ===================== 10 Governance, QA & Records ===================== */
  '10': [
    { id: 'reg17', label: 'Regulation 17 (good governance) referenced', weight: 'critical', patterns: [/regulation\s*17\b|reg\.?\s*17\b|good governance/i] },
    { id: 'audit-schedule', label: 'Audit schedule / programme of quality checks', weight: 'critical', patterns: [/audit (schedule|calendar|programme|plan)|schedule of audits/i] },
    { id: 'records-secure', label: 'Accurate, complete, contemporaneous, secure records', weight: 'critical', patterns: [/contemporaneous|accurate.{0,20}complete|record.{0,30}secure/i] },
    { id: 'action-log', label: 'Action log with owners and deadlines', weight: 'critical', patterns: [/action (log|plan|tracker)|owner.{0,20}(deadline|due date)/i] },
    { id: 'governance-meetings', label: 'Governance meeting cycle & minutes', weight: 'expected', patterns: [/governance meeting|management meeting|minutes/i] },
    { id: 'kpis', label: 'KPIs / quality indicators monitored', weight: 'expected', patterns: [/kpi|key performance|quality indicator|dashboard/i] },
    { id: 'surveys', label: 'Service-user / staff surveys used', weight: 'expected', patterns: [/survey|questionnaire/i] },
    { id: 'pir', label: 'Provider Information Return (PIR) preparation', weight: 'expected', patterns: [/provider information return|pir\b/i] },
    { id: 'mock-inspection', label: 'Mock inspections / independent QA', weight: 'expected', patterns: [/mock inspection|external (audit|consultant)/i] },
    { id: 'retention', label: 'Records retention schedule (DPA storage limitation)', weight: 'critical', patterns: [/retention/i] },
    { id: 'policy-review-log', label: 'Policy review log / version control', weight: 'critical', patterns: [/policy review|version control|document control/i] },
    { id: 'insurance', label: 'Insurance in place (employers/public liability)', weight: 'expected', patterns: [/employers.? liability|public liability|indemnity insurance/i] },
  ],

  /* ================== 11 Staffing, Training & Supervision ================== */
  '11': [
    { id: 'reg18', label: 'Regulation 18 (staffing) referenced', weight: 'critical', patterns: [/regulation\s*18\b|reg\.?\s*18\b/i] },
    { id: 'sufficient-numbers', label: 'Sufficient numbers via dependency/needs (not fixed ratios)', weight: 'critical', patterns: [/sufficient (numbers|staff)|dependency|staffing levels?/i] },
    { id: 'induction', label: 'Induction incl. Care Certificate standards', weight: 'critical', patterns: [/induction|care certificate/i] },
    { id: 'training-matrix', label: 'Training matrix with refresher tracking', weight: 'critical', patterns: [/training matrix|refresher|mandatory training/i] },
    { id: 'oliver-mcgowan', label: 'Oliver McGowan LD & autism training (statutory)', weight: 'critical', patterns: [/oliver mcgowan|learning disability and autism training/i] },
    { id: 'supervision', label: 'Supervision frequency defined', weight: 'critical', patterns: [/supervision/i] },
    { id: 'appraisal', label: 'Annual appraisal process', weight: 'critical', patterns: [/appraisal/i] },
    { id: 'competency', label: 'Competency framework / observed practice', weight: 'expected', patterns: [/competenc|observed practice|direct observation/i] },
    { id: 'spot-checks', label: 'Spot checks / unannounced observations', weight: 'expected', patterns: [/spot check|unannounced/i] },
    { id: 'agency-induction', label: 'Agency/bank staff induction & profile checks', weight: 'expected', patterns: [/agency (staff|worker)|bank staff/i] },
    { id: 'prof-registration', label: 'Professional registration checks (NMC etc.) where employed', weight: 'expected', patterns: [/nmc|professional registration|pin check/i] },
    { id: 'wellbeing', label: 'Staff wellbeing / support arrangements', weight: 'expected', patterns: [/wellbeing|well-being|staff support|counselling/i] },
  ],

  /* ======================= 12 Safe Recruitment & DBS ======================= */
  '12': [
    { id: 'reg19', label: 'Regulation 19 (fit and proper persons employed)', weight: 'critical', patterns: [/regulation\s*19\b|reg\.?\s*19\b|fit and proper person/i] },
    { id: 'schedule3-checks', label: 'Schedule 3 information requirements listed', weight: 'critical', patterns: [/schedule\s*3/i] },
    { id: 'dbs', label: 'Enhanced DBS with barred-list checks', weight: 'critical', patterns: [/\bdbs\b|disclosure and barring|criminal record (check|certificate|disclosure)|enhanced disclosure|barred list/i] },
    { id: 'references', label: 'References obtained and verified', weight: 'critical', patterns: [/(employment|professional|written|two)\s+references?|references?.{0,30}(obtained|verified|checked|requested)/i] },
    { id: 'employment-history', label: 'Full employment history with gaps explored', weight: 'critical', patterns: [/employment history|gaps? in employment/i] },
    { id: 'identity-checks', label: 'Proof of identity verified', weight: 'critical', patterns: [/proof of identity|identity check|photographic id|passport|driving licence/i] },
    { id: 'right-to-work', label: 'Right-to-work checks (incl. sponsorship where used)', weight: 'critical', patterns: [/right to work|share code|sponsorship|visa/i] },
    { id: 'health-declaration', label: 'Health / reasonable adjustments assessment (Reg 19(1)(c))', weight: 'expected', patterns: [/health (declaration|questionnaire)|reasonable adjustments/i] },
    { id: 'dbs-risk-pending', label: 'Risk assessment where staff start pending DBS', weight: 'critical', patterns: [/pending|await(ing)? (dbs|clearance)|risk assessment .{0,40}dbs|dbs .{0,40}risk assessment/i] },
    { id: 'dbs-renewal', label: 'DBS renewal / update service position stated', weight: 'expected', patterns: [/update service|renew(al)? .{0,20}dbs|dbs .{0,20}(renew|every|3 year)/i] },
    { id: 'values-based', label: 'Values-based recruitment approach', weight: 'expected', patterns: [/values.based|value.based recruit/i] },
    { id: 'volunteers', label: 'Volunteer checks addressed (19(3A) relief noted)', weight: 'expected', patterns: [/volunteer/i] },
  ],

  /* ================== 13 Data Protection & Confidentiality ================== */
  '13': [
    { id: 'ukgdpr', label: 'UK GDPR / DPA 2018 referenced', weight: 'critical', patterns: [/uk gdpr|gdpr|data protection act/i] },
    { id: 'lawful-basis', label: 'Lawful basis for processing identified', weight: 'critical', patterns: [/lawful bas(is|es)|article 6/i] },
    { id: 'special-category', label: 'Special-category (health) data + Art. 9 condition', weight: 'critical', patterns: [/special categor|article 9/i] },
    { id: 'ropa', label: 'Record of Processing Activities (Art. 30)', weight: 'critical', patterns: [/ropa|record of processing|article 30/i] },
    { id: 'sar', label: 'Subject access request procedure (1 month)', weight: 'critical', patterns: [/subject access|sar\b|one (calendar )?month/i] },
    { id: 'breach-72h', label: 'Breach response incl. 72-hour ICO reporting', weight: 'critical', patterns: [/72 hours?|data breach/i] },
    { id: 'ico', label: 'ICO registration referenced', weight: 'critical', patterns: [/\bico\b|information commissioner/i] },
    { id: 'confidentiality-staff', label: 'Staff confidentiality obligations', weight: 'expected', patterns: [/confidentialit/i] },
    { id: 'dspt', label: 'Data Security & Protection Toolkit (DSPT) where applicable', weight: 'expected', patterns: [/data security and protection toolkit|dspt/i] },
    { id: 'cyber', label: 'Cyber security controls (passwords/phishing/devices)', weight: 'expected', patterns: [/cyber|phishing|password|encrypt/i] },
    { id: 'cctv-social', label: 'CCTV / photography / social media rules', weight: 'expected', patterns: [/cctv|photograph|social media|mobile phone/i] },
    { id: 'sharing', label: 'Lawful information sharing (GPs/community teams)', weight: 'expected', patterns: [/information sharing|share.{0,30}(gp|professional|nhs)/i] },
  ],

  /* ==================== 14 Health & Safety (office/community) ==================== */
  '14': [
    { id: 'hswa', label: 'HSWA 1974 duty referenced', weight: 'critical', patterns: [/health and safety at work|hswa|1974/i] },
    { id: 'written-policy-5plus', label: 'Written H&S policy (5+ employees) duty stated', weight: 'critical', patterns: [/5 (or more )?employees|five or more/i] },
    { id: 'fire', label: 'Fire safety (RRO 2005) incl. risk assessment', weight: 'critical', patterns: [/fire/i] },
    { id: 'peep', label: 'PEEPs (personal emergency evacuation plans) where relevant', weight: 'expected', patterns: [/peep|personal emergency evacuation/i] },
    { id: 'coshh', label: 'COSHH assessments', weight: 'critical', patterns: [/coshh/i] },
    { id: 'riddor', label: 'RIDDOR reporting duty', weight: 'critical', patterns: [/riddor/i] },
    { id: 'first-aid', label: 'First aid arrangements', weight: 'critical', patterns: [/first aid/i] },
    { id: 'workplace-ra', label: 'General workplace risk assessment', weight: 'critical', patterns: [/workplace risk assessment|general risk assessment/i] },
    { id: 'display-screen', label: 'DSE / display screen assessments (office)', weight: 'expected', patterns: [/display screen|dse\b|workstation/i] },
    { id: 'electrical-gas', label: 'Electrical (PAT) / gas safety checks', weight: 'expected', patterns: [/pat test|portable appliance|gas safe|electrical (safety|test)/i] },
    { id: 'legionella-water', label: 'Legionella / water safety (premises services)', weight: 'expected', patterns: [/legionella|water (safety|temperature)/i] },
    { id: 'sharps-waste', label: 'Sharps / clinical waste handling where applicable', weight: 'expected', patterns: [/sharps|clinical waste/i] },
  ],

  /* ==================== 15 Infection Prevention & Control ==================== */
  '15': [
    { id: 'reg12h', label: 'Reg 12(2)(h) IPC duty referenced', weight: 'critical', patterns: [/12\s*\(\s*2\s*\)\s*\(\s*h\s*\)|prevent(ing|ion)?[, ].{0,30}(detect|control).{0,30}infection|infection prevention/i] },
    { id: 'code-of-practice', label: 'IPC Code of Practice (Hygiene Code, HSCA s.21)', weight: 'critical', patterns: [/code of practice|hygiene code|section 21|s\.?\s?21/i] },
    { id: 'ipc-lead', label: 'IPC lead designated', weight: 'expected', patterns: [/ipc lead|infection control lead/i] },
    { id: 'standard-precautions', label: 'Standard precautions defined', weight: 'critical', patterns: [/standard precaution|universal precaution/i] },
    { id: 'hand-hygiene', label: 'Hand hygiene technique & moments', weight: 'critical', patterns: [/hand (hygiene|wash)/i] },
    { id: 'ppe', label: 'PPE selection, use and disposal', weight: 'critical', patterns: [/\bppe\b|personal protective equipment/i] },
    { id: 'ipc-audit', label: 'IPC audits with scored action plans', weight: 'expected', patterns: [/ipc audit|infection.{0,20}audit|hand hygiene audit/i] },
    { id: 'outbreak', label: 'Outbreak recognition & management (incl. UKHSA)', weight: 'critical', patterns: [/outbreak|ukhsa|health protection team/i] },
    { id: 'laundry-spills', label: 'Laundry / body-fluid spillage procedures', weight: 'expected', patterns: [/laundry|spillage|body fluid/i] },
    { id: 'vaccination', label: 'Staff immunisation/vaccination position', weight: 'expected', patterns: [/vaccin|immunis/i] },
  ],

  /* ==================== 16 Notifications (CQC statutory) ==================== */
  '16': [
    { id: 'regs-16-18-2009', label: '2009 Registration Regs notification duties cited', weight: 'critical', patterns: [/registration\)? regulations 2009|regs? 16|regs? 17|regs? 18|statutory notification/i] },
    { id: 'without-delay', label: '"Without delay" duty stated', weight: 'critical', patterns: [/without delay/i] },
    { id: 'death-notification', label: 'Death of a service user notifiable', weight: 'critical', patterns: [/death/i] },
    { id: 'serious-injury', label: 'Serious injury notifiable', weight: 'critical', patterns: [/serious injur/i] },
    { id: 'abuse-notification', label: 'Abuse / allegation of abuse notifiable', weight: 'critical', patterns: [/allegation.{0,30}abuse|abuse.{0,40}notif/i] },
    { id: 'dols-outcome', label: 'DoLS application outcomes notifiable', weight: 'critical', patterns: [/deprivation of liberty|dols|liberty protection safeguard/i] },
    { id: 'police-incident', label: 'Incidents reported to/investigated by police notifiable', weight: 'expected', patterns: [/police/i] },
    { id: 'events-disrupt', label: 'Events stopping safe service (Reg 18-type) notifiable', weight: 'expected', patterns: [/disrupt|unable to (operate|provide)|interruption/i] },
    { id: 'decision-tool', label: 'Notification decision tool / log maintained', weight: 'expected', patterns: [/decision (form|tool|log)|notifications? log/i] },
    { id: 'provider-portal', label: 'Submission route (CQC provider portal/forms)', weight: 'expected', patterns: [/provider portal|cqc (portal|website|form)/i] },
  ],

  /* ================ 17 Business Continuity & Emergency Planning ================ */
  '17': [
    { id: 'bcp', label: 'Business continuity plan in place (Reg 17 risk duty)', weight: 'critical', patterns: [/business continuity/i] },
    { id: 'emergency-oncall', label: 'Emergency / on-call arrangements', weight: 'critical', patterns: [/on.call|emergency (procedure|plan|contact)/i] },
    { id: 'scenarios', label: 'Key scenarios covered (IT, staffing, premises, utilities, weather, pandemic)', weight: 'critical', patterns: [/it failure|system failure|staff(ing)? shortage|adverse weather|power (cut|failure|outage)|pandemic|flood|fuel/i] },
    { id: 'priority-clients', label: 'Priority service users identified for continuity', weight: 'expected', patterns: [/priorit(y|ise).{0,40}(service user|client|visit|call)/i] },
    { id: 'paper-fallback', label: 'Paper-based fallback for records/rotas', weight: 'expected', patterns: [/paper.based|manual (records|process)|offline/i] },
    { id: 'contacts-register', label: 'Emergency contacts register maintained', weight: 'expected', patterns: [/emergency contact/i] },
    { id: 'test-log', label: 'Plan tested and lessons captured', weight: 'expected', patterns: [/test(ed|ing)? (the )?(plan|annually|regularly)|continuity test|exercise/i] },
  ],

  /* ================ 18 Dignity, Equality & Service-User Rights ================ */
  '18': [
    { id: 'reg10', label: 'Regulation 10 (dignity and respect) referenced', weight: 'critical', patterns: [/regulation\s*10\b|reg\.?\s*10\b|dignity and respect/i] },
    { id: 'privacy', label: 'Privacy protections (incl. personal care)', weight: 'critical', patterns: [/privacy/i] },
    { id: 'equality-act', label: 'Equality Act 2010 / protected characteristics', weight: 'critical', patterns: [/equality act|protected characteristic/i] },
    { id: 'autonomy', label: 'Autonomy, independence & community involvement', weight: 'critical', patterns: [/autonomy|independence/i] },
    { id: 'accessible-info', label: 'Accessible Information Standard implemented', weight: 'expected', patterns: [/accessible information/i] },
    { id: 'human-rights', label: 'Human Rights Act (Arts 3/8) referenced', weight: 'expected', patterns: [/human rights/i] },
    { id: 'edi', label: 'EDI commitments incl. workforce', weight: 'expected', patterns: [/equality,? diversity|edi\b|inclusion/i] },
    { id: 'cultural-religious', label: 'Cultural / religious needs met', weight: 'expected', patterns: [/cultural|religio|spiritual/i] },
    { id: 'lgbtq', label: 'LGBTQ+ inclusive care addressed', weight: 'expected', patterns: [/lgbt/i] },
    { id: 'interpreters', label: 'Interpreting / translation arrangements', weight: 'expected', patterns: [/interpret|translat/i] },
    { id: 'service-user-guide', label: 'Service user guide provided', weight: 'expected', patterns: [/service user guide|welcome (pack|guide)|statement of terms/i] },
  ],
};

/**
 * EXTENDED EXPECTATIONS — evidence artefacts beyond the 139-document library
 * that inspectors, commissioners or insurers commonly ask for. Reported in
 * their own section: supplied / not supplied among the documents provided.
 */
export const EXTENDED_EXPECTATIONS = [
  { id: 'insurance-cert', label: 'Insurance certificate (employers’/public liability)', patterns: [/certificate of (employers|public) liability|policy number.{0,40}liab|insurance schedule/i] },
  { id: 'registration-cert', label: 'CQC registration certificate', patterns: [/certificate of registration.{0,60}(cqc|care quality commission)|cqc.{0,60}certificate of registration/i] },
  { id: 'org-chart', label: 'Organisational / accountability structure', patterns: [/organisation(al)? (chart|structure)|reporting lines/i] },
  { id: 'rota-sample', label: 'Rota / roster arrangements', patterns: [/rota|roster/i] },
  { id: 'dependency-tool', label: 'Dependency / staffing calculation tool', patterns: [/dependency (tool|score|calculat)/i] },
  { id: 'pir-draft', label: 'Provider Information Return content', patterns: [/provider information return|pir\b/i] },
  { id: 'gas-cert', label: 'Gas safety record (premises)', patterns: [/gas safe|cp12|landlord gas/i] },
  { id: 'electrical-cert', label: 'Electrical installation / PAT records', patterns: [/eicr|electrical installation|pat test/i] },
  { id: 'fire-drill-log', label: 'Fire drill / alarm test logs', patterns: [/fire drill|alarm test|weekly fire/i] },
  { id: 'legionella-ra', label: 'Legionella risk assessment (premises)', patterns: [/legionella/i] },
  { id: 'food-hygiene', label: 'Food hygiene rating / safer food records (where meals prepared)', patterns: [/food hygiene|safer food|scores on the doors|ehohttp/i] },
  { id: 'dspt-status', label: 'DSPT submission status', patterns: [/data security and protection toolkit|dspt/i] },
  { id: 'website-rating', label: 'Website displays CQC rating (Reg 20A)', patterns: [/rating.{0,40}(website|displayed)|website.{0,40}rating/i] },
  { id: 'staff-handbook', label: 'Staff handbook', patterns: [/staff handbook|employee handbook/i] },
  { id: 'code-of-conduct', label: 'Staff code of conduct', patterns: [/code of conduct/i] },
  { id: 'grievance-disciplinary', label: 'Grievance & disciplinary procedures', patterns: [/grievance|disciplinary/i] },
  { id: 'sickness-absence', label: 'Sickness / absence management', patterns: [/sickness absence|absence management/i] },
  { id: 'meeting-minutes', label: 'Team / governance meeting minutes', patterns: [/minutes of (the )?meeting|meeting minutes/i] },
  { id: 'newsletter-comms', label: 'Service-user/family communications (newsletters etc.)', patterns: [/newsletter|families? update/i] },
  { id: 'environmental-policy', label: 'Environmental sustainability policy (SAF WL34)', patterns: [/environmental (policy|sustainab)|single.use plastic|carbon/i] },
];

/**
 * Document-control checks applied to EVERY document individually.
 */
export const DOC_CHECKS = [
  { id: 'version', label: 'Version number present', found: [/version\s*[:# ]?\s*\d|v\d+(\.\d+)?\b/i] },
  { id: 'review-date', label: 'Review / next-review date present', found: [/(next )?review( date| due)?\s*[:\-–]/i, /review(ed)?\s*(on|date)/i] },
  { id: 'owner', label: 'Document owner / approver named', found: [/(document )?(owner|author|approved by|responsible (person|manager))\s*[:\-–]/i] },
  { id: 'legal-basis', label: 'Legislative basis cited', found: [/regulation\s*\d+|act \d{4}|regulations \d{4}|hsca|uk gdpr/i] },
];

/**
 * Red flags applied to EVERY line of EVERY document — each hit quoted verbatim.
 */
export const RED_FLAGS = [
  { id: 'unfilled-placeholder', label: 'Unfilled template placeholder', severity: 'critical',
    pattern: /\[(insert|name|date|provider|manager|service|company|address|title|role|xx+|\s*)\]|\[[A-Z][A-Z /&-]{2,}\]/ },
  { id: 'template-artifact', label: 'Template artifact left in document', severity: 'critical',
    pattern: /lorem ipsum|your (company|organisation|service) name|delete (this|as appropriate)|<[a-z]+ name>/i },
  { id: 'old-regime', label: 'Outdated pre-2014 CQC regime language ("Outcomes"/ESQS)', severity: 'critical',
    pattern: /essential standards of quality and safety|\boutcome \d{1,2}\b/i },
  { id: 'old-kloe', label: 'Legacy KLOE framework referenced (superseded by SAF)', severity: 'advisory',
    pattern: /\bkloes?\b|key lines? of enquiry/i },
  { id: 'wrong-country', label: 'Non-England regulator referenced (check jurisdiction)', severity: 'advisory',
    pattern: /care inspectorate\b|ciw\b|rqia/i },
];

/** Review-date extraction for staleness checking. */
export const REVIEW_DATE_LINE = /(next review|review due|review date|to be reviewed|date of (next )?review)\s*(by|on|date)?\s*[:\-–]?\s*(.{0,40})/i;

export const DATE_PATTERNS = [
  { re: /\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/, build: (m) => new Date(norm4(m[3]), Number(m[2]) - 1, Number(m[1])) },
  { re: /\b(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})\b/i,
    build: (m) => new Date(Number(m[3]), MONTHS[m[2].toLowerCase()], Number(m[1])) },
  { re: /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})\b/i,
    build: (m) => new Date(Number(m[2]), MONTHS[m[1].toLowerCase()], 1) },
];

const MONTHS = { january:0,february:1,march:2,april:3,may:4,june:5,july:6,august:7,september:8,october:9,november:10,december:11 };
function norm4(y) { const n = Number(y); return n < 100 ? 2000 + n : n; }
