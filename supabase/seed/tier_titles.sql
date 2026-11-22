-- Tier lists. Keys are normalised title_key values (see src/lib/titles.ts):
-- lower case, no apostrophes, hyphens as spaces, single spaces.
-- Anything not listed here is a standard title.

insert into tier_titles (title_key, tier) values
-- Iconic: 25 titles everyone knows ($99)
('dad','iconic'),('mom','iconic'),('mum','iconic'),('mother','iconic'),('father','iconic'),
('boss','iconic'),('friend','iconic'),('teacher','iconic'),('wife','iconic'),('husband','iconic'),
('girlfriend','iconic'),('boyfriend','iconic'),('partner','iconic'),('grandma','iconic'),('grandpa','iconic'),
('son','iconic'),('daughter','iconic'),('daddy','iconic'),('mommy','iconic'),('mummy','iconic'),
('papa','iconic'),('mama','iconic'),('granny','iconic'),('nana','iconic'),('grandad','iconic')
on conflict (title_key) do update set tier = excluded.tier;

insert into tier_titles (title_key, tier) values
-- Popular: family
('sister','popular'),('brother','popular'),('uncle','popular'),('aunt','popular'),('auntie','popular'),
('cousin','popular'),('niece','popular'),('nephew','popular'),('grandmother','popular'),('grandfather','popular'),
('granddad','popular'),('grandpop','popular'),('gran','popular'),('grandson','popular'),('granddaughter','popular'),
('grandchild','popular'),('grandkid','popular'),('stepdad','popular'),('stepmom','popular'),('stepmum','popular'),
('stepmother','popular'),('stepfather','popular'),('stepsister','popular'),('stepbrother','popular'),('stepson','popular'),
('stepdaughter','popular'),('mother in law','popular'),('father in law','popular'),('sister in law','popular'),('brother in law','popular'),
('son in law','popular'),('daughter in law','popular'),('godmother','popular'),('godfather','popular'),('godson','popular'),
('goddaughter','popular'),('godparent','popular'),('twin','popular'),('twin sister','popular'),('twin brother','popular'),
('big sister','popular'),('big brother','popular'),('little sister','popular'),('little brother','popular'),('baby sister','popular'),
('baby brother','popular'),('sis','popular'),('bro','popular'),('sibling','popular'),('parent','popular'),
('parents','popular'),('mom and dad','popular'),('mum and dad','popular'),('grandparents','popular'),('family','popular'),
('kid','popular'),('kids','popular'),('child','popular'),('baby','popular'),('toddler','popular'),
('pops','popular'),('pa','popular'),('ma','popular'),('mommy to be','popular'),('dad to be','popular'),
('mom to be','popular'),('new dad','popular'),('new mom','popular'),('first time dad','popular'),('first time mom','popular'),
('single mom','popular'),('single dad','popular'),('girl dad','popular'),('boy mom','popular'),('boy dad','popular'),
('girl mom','popular'),('dog dad','popular'),('dog mom','popular'),('cat dad','popular'),('cat mom','popular'),
('dog mum','popular'),('cat mum','popular'),('plant mom','popular'),('plant dad','popular'),('bonus mom','popular'),
('bonus dad','popular'),('abuela','popular'),('abuelo','popular'),('nonna','popular'),('nonno','popular'),
('oma','popular'),('opa','popular'),('mimi','popular'),('gigi','popular'),('pawpaw','popular'),
-- Popular: relationships
('fiance','popular'),('fiancee','popular'),('spouse','popular'),('hubby','popular'),('wifey','popular'),
('bride','popular'),('groom','popular'),('bride to be','popular'),('groom to be','popular'),('valentine','popular'),
('soulmate','popular'),('sweetheart','popular'),('lover','popular'),('crush','popular'),('date','popular'),
('other half','popular'),('better half','popular'),('significant other','popular'),('babe','popular'),('bae','popular'),
('honey','popular'),('darling','popular'),('cuddler','popular'),('kisser','popular'),('hugger','popular'),
('best friend','popular'),('bestie','popular'),('bff','popular'),('buddy','popular'),('pal','popular'),
('mate','popular'),('roommate','popular'),('flatmate','popular'),('housemate','popular'),('neighbor','popular'),
('neighbour','popular'),('bridesmaid','popular'),('maid of honor','popular'),('maid of honour','popular'),('best man','popular'),
('groomsman','popular'),('wingman','popular'),('girlfriend ever','popular'),('boyfriend ever','popular'),('pen pal','popular'),
('travel buddy','popular'),('gym buddy','popular'),('work wife','popular'),('work husband','popular'),('work bestie','popular'),
-- Popular: jobs
('nurse','popular'),('chef','popular'),('doctor','popular'),('coach','popular'),('manager','popular'),
('coworker','popular'),('colleague','popular'),('employee','popular'),('team','popular'),('team leader','popular'),
('mentor','popular'),('intern','popular'),('engineer','popular'),('developer','popular'),('programmer','popular'),
('designer','popular'),('architect','popular'),('lawyer','popular'),('accountant','popular'),('dentist','popular'),
('pharmacist','popular'),('vet','popular'),('veterinarian','popular'),('surgeon','popular'),('midwife','popular'),
('paramedic','popular'),('firefighter','popular'),('police officer','popular'),('pilot','popular'),('flight attendant','popular'),
('driver','popular'),('mechanic','popular'),('electrician','popular'),('plumber','popular'),('carpenter','popular'),
('builder','popular'),('farmer','popular'),('gardener','popular'),('baker','popular'),('barista','popular'),
('bartender','popular'),('waiter','popular'),('waitress','popular'),('cook','popular'),('hairdresser','popular'),
('barber','popular'),('stylist','popular'),('makeup artist','popular'),('photographer','popular'),('videographer','popular'),
('writer','popular'),('author','popular'),('editor','popular'),('journalist','popular'),('artist','popular'),
('painter','popular'),('musician','popular'),('singer','popular'),('drummer','popular'),('guitarist','popular'),
('dancer','popular'),('actor','popular'),('dj','popular'),('producer','popular'),
('principal','popular'),('professor','popular'),('tutor','popular'),('librarian','popular'),('student','popular'),
('nanny','popular'),('babysitter','popular'),('caregiver','popular'),('therapist','popular'),('counselor','popular'),
('social worker','popular'),('scientist','popular'),('researcher','popular'),('salesman','popular'),('realtor','popular'),
('receptionist','popular'),('assistant','popular'),('secretary','popular'),('ceo','popular'),('founder','popular'),
('entrepreneur','popular'),('boss lady','popular'),('soldier','popular'),('veteran','popular'),('trainer','popular'),
('personal trainer','popular'),('yoga teacher','popular'),('referee','popular'),('lifeguard','popular'),('dog walker','popular'),
('delivery driver','popular'),('postman','popular'),('mail carrier','popular'),('janitor','popular'),('cleaner','popular'),
-- Popular: hobbies and everyday
('gamer','popular'),('golfer','popular'),('runner','popular'),('cyclist','popular'),
('fisherman','popular'),('hiker','popular'),('swimmer','popular'),('skier','popular'),('surfer','popular'),
('footballer','popular'),('soccer mom','popular'),('hockey mom','popular'),('dance mom','popular'),('griller','popular'),
('bbq dad','popular'),('napper','popular'),('snorer','popular'),('storyteller','popular'),
('listener','popular'),('dishwasher','popular'),
('husband ever','popular'),('wife ever','popular'),('dad ever','popular'),('mom ever','popular'),
('mum ever','popular'),('grandma ever','popular'),('grandpa ever','popular'),('sister ever','popular'),('brother ever','popular'),
('friend ever','popular'),('boss ever','popular'),('teacher ever','popular'),('son ever','popular'),('daughter ever','popular')
on conflict (title_key) do update set tier = excluded.tier;
