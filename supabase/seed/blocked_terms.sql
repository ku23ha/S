-- Blocked terms. Matched against whole words (and whole multi-word phrases)
-- of the normalised title_key, so 'ass' blocks "Ass" but not "Assistant".
-- Titles containing any of these are rejected at search time. Keep entries
-- normalised: lower case, no apostrophes, single spaces.

insert into blocked_terms (term) values
-- Profanity and sexual terms
('fuck'),('fucker'),('fucking'),('motherfucker'),('shit'),('shitter'),('bullshit'),('ass'),('asshole'),('arse'),
('arsehole'),('bitch'),('bastard'),('dick'),('dickhead'),('cock'),('cocksucker'),('pussy'),('cunt'),('twat'),
('wanker'),('prick'),('slut'),('whore'),('hoe'),('skank'),('tits'),('boobs'),('penis'),('vagina'),
('dildo'),('porn'),('porno'),('sex'),('sexy'),('horny'),('blowjob'),('handjob'),('orgasm'),('cum'),
('milf'),('dilf'),('stripper'),('hooker'),('escort'),('pimp'),('nude'),('naked'),('fetish'),('bdsm'),
('incest'),('rapist'),('rape'),('molester'),('pedo'),('pedophile'),('paedophile'),('groomer'),
-- Slurs and hate
('nigger'),('nigga'),('negro'),('chink'),('gook'),('spic'),('wetback'),('kike'),('paki'),('raghead'),
('towelhead'),('coon'),('jap'),('beaner'),('gypsy'),('tranny'),('faggot'),('fag'),('dyke'),('homo'),
('retard'),('retarded'),('spaz'),('cripple'),('midget'),('nazi'),('hitler'),('kkk'),('isis'),('jihadi'),
('terrorist'),('white power'),('heil'),
-- Insults that turn a gift into harassment
('loser'),('idiot'),('moron'),('stupid'),('dumb'),('dumbass'),('ugly'),('fatso'),('fatty'),
('liar'),('cheater'),('cheat'),('fraud'),('scammer'),('thief'),('criminal'),('psycho'),('freak'),('creep'),
('pervert'),('perv'),('weirdo'),('failure'),('disappointment'),('deadbeat'),('scum'),('dirtbag'),
('abuser'),('wife beater'),('killer'),('murderer'),('stalker'),
-- Violence, self-harm and drugs
('kill'),('murder'),('suicide'),('shooter'),('bomber'),('cocaine'),('heroin'),('meth'),('crack'),('stoner'),
('drug dealer'),
-- Words that would imply real status (copy rule 6)
('official'),('legal'),('certified'),('accredited'),('licensed'),('government')
on conflict (term) do nothing;
