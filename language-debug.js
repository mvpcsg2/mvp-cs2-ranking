id="mvp-language-system">
(function(){
 const KEY='mvp_cs2_language_v1';
 const dictionaries={
 en:{
 'Рейтинг':'Ranking','Турнир':'Tournament','Матчи':'Matches','Трансляции':'Streams','Топ игроков':'Top players','Новости':'News',
 'Настройки':'Settings','Войти / регистрация':'Login / Register','Выйти':'Log out','Публичный просмотр':'Public view','Помощь':'Help',
 'ОФОРМЛЕНИЕ':'APPEARANCE','Выбери оформление сайта и настрой его внешний вид.':'Choose the site appearance and customize its look.',
 'Закрыть':'Close','Светлая тема':'Light theme','Тёмно-серые панели':'Dark gray panels','DAY · Дневная':'DAY · Light','NIGHT · Ночная':'NIGHT · Dark',
 'Выбор темы сохраняется на этом устройстве. Логотип и фон сайта сохраняются в общей базе и видны всем посетителям.':'Your theme choice is saved on this device. The logo and background are saved centrally and visible to all visitors.',
 'ЯЗЫК / LANGUAGE':'LANGUAGE','Язык интерфейса сохраняется на этом устройстве.':'Your language choice is saved on this device.',
 'Состав команды':'Team roster','Состав команды ·':'Team roster ·','Профиль команды':'Team profile','Игроков':'players',
 'Место':'Rank','Команда':'Team','Очки':'Points','Сохранить':'Save','Отмена':'Cancel','Удалить':'Delete','Изменить':'Edit',
 'Добавить':'Add','Поиск':'Search','Загрузка…':'Loading…','Сохранить изменения':'Save changes','Назад':'Back','Далее':'Next',
 'Текущий день':'Current day','Сегодня':'Today','Вчера':'Yesterday','Кубки':'Trophies','Статистика':'Statistics',
 'Участники':'Participants','Результаты':'Results','Дата':'Date','Время':'Time','Сезон':'Season','Архив':'Archive',
 'Нет данных':'No data','Пока нет данных.':'No data yet.','Обновить':'Refresh','Подтвердить':'Confirm','Отправить':'Send',
 'Сообщение':'Message','Имя':'Name','Описание':'Description','Ссылка':'Link','Загрузить':'Upload','Убрать':'Remove',
 'Сохранить кубок':'Save trophy','Очистить форму':'Clear form','Название кубка':'Trophy name',
 'ФОН САЙТА':'SITE BACKGROUND','ЛОГОТИП САЙТА':'SITE LOGO','КОНСТРУКТОР КУБКОВ':'TROPHY BUILDER',
 'Рейтинг команд':'Team ranking',
 'Текущий сезон':'Current season',
 'рейтинг и статистика команд':'team rankings and statistics',
 'НУЖНА SQL-МИГРАЦИЯ':'SQL MIGRATION REQUIRED',
 'Пока нет команд в общей базе данных. Администратор может перенести сохранённые команды или добавить первую команду.':'There are no teams in the shared database yet. An administrator can migrate saved teams or add the first team.',
 'Общая база подключена. Команды появятся после их переноса администратором.':'Shared database connected. Teams will appear after an administrator migrates them.',
 'Суббота':'Saturday',
 'Воскресенье':'Sunday',
 'Понедельник':'Monday',
 'Вторник':'Tuesday',
 'Среда':'Wednesday',
 'Четверг':'Thursday',
 'Пятница':'Friday',
 'ТРАНСФЕРЫ':'TRANSFERS',
 'БЛОКИРОВКИ':'BANS',
 'SEASONS · ГОДЫ':'SEASONS · YEARS',
 'МЕСТО':'RANK',
 'КОМАНДА':'TEAM',
 'ИЗМЕНЕНИЕ':'CHANGE',
 'Не удалось загрузить новости из Neon API.':'Could not load news from Neon API.',
 'Трансферов за этот год пока нет.':'There are no transfers for this year yet.',
 },
 uk:{
 'Рейтинг':'Рейтинг','Турнир':'Турнір','Матчи':'Матчі','Трансляции':'Трансляції','Топ игроков':'Топ гравців','Новости':'Новини',
 'Настройки':'Налаштування','Войти / регистрация':'Увійти / реєстрація','Выйти':'Вийти','Публичный просмотр':'Публічний перегляд','Помощь':'Допомога',
 'ОФОРМЛЕНИЕ':'ОФОРМЛЕННЯ','Выбери оформление сайта и настрой его внешний вид.':'Обери оформлення сайту та налаштуй його вигляд.',
 'Закрыть':'Закрити','Светлая тема':'Світла тема','Тёмно-серые панели':'Темно-сірі панелі','DAY · Дневная':'DAY · Денна','NIGHT · Ночная':'NIGHT · Нічна',
 'Выбор темы сохраняется на этом устройстве. Логотип и фон сайта сохраняются в общей базе и видны всем посетителям.':'Вибір теми зберігається на цьому пристрої. Логотип і тло сайту зберігаються в спільній базі та видимі всім відвідувачам.',
 'ЯЗЫК / LANGUAGE':'МОВА / LANGUAGE','Язык интерфейса сохраняется на этом устройстве.':'Мову інтерфейсу збережено на цьому пристрої.',
 'Состав команды':'Склад команди','Состав команды ·':'Склад команди ·','Профиль команды':'Профіль команди','Игроков':'гравців',
 'Место':'Місце','Команда':'Команда','Очки':'Бали','Сохранить':'Зберегти','Отмена':'Скасувати','Удалить':'Видалити','Изменить':'Змінити',
 'Добавить':'Додати','Поиск':'Пошук','Загрузка…':'Завантаження…','Сохранить изменения':'Зберегти зміни','Назад':'Назад','Далее':'Далі',
 'Текущий день':'Поточний день','Сегодня':'Сьогодні','Вчера':'Учора','Кубки':'Кубки','Статистика':'Статистика',
 'Участники':'Учасники','Результаты':'Результати','Дата':'Дата','Время':'Час','Сезон':'Сезон','Архив':'Архів',
 'Нет данных':'Немає даних','Пока нет данных.':'Поки немає даних.','Обновить':'Оновити','Подтвердить':'Підтвердити','Отправить':'Надіслати',
 'Сообщение':'Повідомлення','Имя':'Ім’я','Описание':'Опис','Ссылка':'Посилання','Загрузить':'Завантажити','Убрать':'Прибрати',
 'Сохранить кубок':'Зберегти кубок','Очистить форму':'Очистити форму','Название кубка':'Назва кубка',
 'ФОН САЙТА':'ТЛО САЙТУ','ЛОГОТИП САЙТА':'ЛОГОТИП САЙТУ','КОНСТРУКТОР КУБКОВ':'КОНСТРУКТОР КУБКІВ',
 'Рейтинг команд':'Рейтинг команд',
 'Текущий сезон':'Поточний сезон',
 'рейтинг и статистика команд':'рейтинг і статистика команд',
 'НУЖНА SQL-МИГРАЦИЯ':'ПОТРІБНА SQL-МІГРАЦІЯ',
 'Пока нет команд в общей базе данных. Администратор может перенести сохранённые команды или добавить первую команду.':'У спільній базі даних поки немає команд. Адміністратор може перенести збережені команди або додати першу команду.',
 'Общая база подключена. Команды появятся после их переноса администратором.':'Спільну базу даних підключено. Команди з’являться після перенесення адміністратором.',
 'Суббота':'Субота',
 'Воскресенье':'Неділя',
 'Понедельник':'Понеділок',
 'Вторник':'Вівторок',
 'Среда':'Середа',
 'Четверг':'Четвер',
 'Пятница':'П’ятниця',
 'ТРАНСФЕРЫ':'ТРАНСФЕРИ',
 'БЛОКИРОВКИ':'БЛОКУВАННЯ',
 'SEASONS · ГОДЫ':'СЕЗОНИ · РОКИ',
 'МЕСТО':'МІСЦЕ',
 'КОМАНДА':'КОМАНДА',
 'ИЗМЕНЕНИЕ':'ЗМІНА',
 'Не удалось загрузить новости из Neon API.':'Не вдалося завантажити новини з Neon API.',
 'Трансферов за этот год пока нет.':'Цього року трансферів поки немає.',
 },
 de:{
 'Рейтинг':'Rangliste','Турнир':'Turnier','Матчи':'Spiele','Трансляции':'Streams','Топ игроков':'Top-Spieler','Новости':'News',
 'Настройки':'Einstellungen','Войти / регистрация':'Anmelden / Registrieren','Выйти':'Abmelden','Публичный просмотр':'Öffentliche Ansicht','Помощь':'Hilfe',
 'ОФОРМЛЕНИЕ':'DARSTELLUNG','Выбери оформление сайта и настрой его внешний вид.':'Wähle das Erscheinungsbild der Website.',
 'Закрыть':'Schließen','Светлая тема':'Helles Design','Тёмно-серые панели':'Dunkelgraue Felder','DAY · Дневная':'DAY · Hell','NIGHT · Ночная':'NIGHT · Dunkel',
 'Выбор темы сохраняется на этом устройстве. Логотип и фон сайта сохраняются в общей базе и видны всем посетителям.':'Die Designauswahl wird auf diesem Gerät gespeichert. Logo und Hintergrund sind für alle Besucher sichtbar.',
 'ЯЗЫК / LANGUAGE':'SPRACHE / LANGUAGE','Язык интерфейса сохраняется на этом устройстве.':'Die Sprachauswahl wird auf diesem Gerät gespeichert.',
 'Состав команды':'Teamaufstellung','Состав команды ·':'Teamaufstellung ·','Профиль команды':'Teamprofil','Игроков':'Spieler',
 'Место':'Platz','Команда':'Team','Очки':'Punkte','Сохранить':'Speichern','Отмена':'Abbrechen','Удалить':'Löschen','Изменить':'Bearbeiten',
 'Добавить':'Hinzufügen','Поиск':'Suche','Загрузка…':'Wird geladen…','Сохранить изменения':'Änderungen speichern','Назад':'Zurück','Далее':'Weiter',
 'Текущий день':'Aktueller Tag','Сегодня':'Heute','Вчера':'Gestern','Кубки':'Pokale','Статистика':'Statistik',
 'Участники':'Teilnehmer','Результаты':'Ergebnisse','Дата':'Datum','Время':'Uhrzeit','Сезон':'Saison','Архив':'Archiv',
 'Нет данных':'Keine Daten','Пока нет данных.':'Noch keine Daten.','Обновить':'Aktualisieren','Подтвердить':'Bestätigen','Отправить':'Senden',
 'Сообщение':'Nachricht','Имя':'Name','Описание':'Beschreibung','Ссылка':'Link','Загрузить':'Hochladen','Убрать':'Entfernen',
 'Сохранить кубок':'Pokal speichern','Очистить форму':'Formular leeren','Название кубка':'Pokalname',
 'ФОН САЙТА':'WEBSITE-HINTERGRUND','ЛОГОТИП САЙТА':'WEBSITE-LOGO','КОНСТРУКТОР КУБКОВ':'POKAL-EDITOR',
 'Рейтинг команд':'Team-Rangliste',
 'Текущий сезон':'Aktuelle Saison',
 'рейтинг и статистика команд':'Team-Ranglisten und Statistiken',
 'НУЖНА SQL-МИГРАЦИЯ':'SQL-MIGRATION ERFORDERLICH',
 'Пока нет команд в общей базе данных. Администратор может перенести сохранённые команды или добавить первую команду.':'Es gibt noch keine Teams in der gemeinsamen Datenbank. Ein Administrator kann gespeicherte Teams migrieren oder das erste Team hinzufügen.',
 'Общая база подключена. Команды появятся после их переноса администратором.':'Gemeinsame Datenbank verbunden. Teams erscheinen, sobald ein Administrator sie migriert hat.',
 'Суббота':'Samstag',
 'Воскресенье':'Sonntag',
 'Понедельник':'Montag',
 'Вторник':'Dienstag',
 'Среда':'Mittwoch',
 'Четверг':'Donnerstag',
 'Пятница':'Freitag',
 'ТРАНСФЕРЫ':'TRANSFERS',
 'БЛОКИРОВКИ':'SPERREN',
 'SEASONS · ГОДЫ':'SAISONS · JAHRE',
 'МЕСТО':'PLATZ',
 'КОМАНДА':'TEAM',
 'ИЗМЕНЕНИЕ':'ÄNDERUNG',
 'Не удалось загрузить новости из Neon API.':'Nachrichten konnten nicht von der Neon API geladen werden.',
 'Трансферов за этот год пока нет.':'Für dieses Jahr gibt es noch keine Transfers.',
 }
 };

 // Full modal/navigation coverage. Source strings may be Russian OR English,
 // because several older dialogs are authored directly in English.
 const modalTranslations={
 en:{
 'Все':'All','News сайта':'Site news','Трансферы':'Transfers','Блокировки':'Bans','Close':'Close',
 'News':'News','Top players':'Top players','Streams CS2':'CS2 Streams','Matches MVP CS2':'MVP CS2 Matches',
 'Tournamentная сетка MVP CS2':'MVP CS2 Tournament Bracket','Help':'Help','Log in':'Log in','Register':'Register',
 'Войти':'Log in','Забыли пароль?':'Forgot password?','Отправить письмо подтверждения':'Send confirmation email',
 'Email':'Email','Пароль':'Password','Введите email и пароль от аккаунта MVP CS2 Ranking':'Enter your MVP CS2 Ranking account email and password',
 'Расписание и результаты матчей команд.':'Team match schedule and results.',
 'YouTube-эфиры и записи, добавленные администрацией MVP CS2 Ranking.':'YouTube live streams and recordings added by MVP CS2 Ranking administrators.',
 'Игроки из составов команд · рейтинг по среднему K/D за записанные матчи.':'Players from team rosters · ranked by average K/D across recorded matches.',
 'Трансферы, блокировки, объявления и события киберспортивного сообщества.':'Transfers, bans, announcements and esports community events.',
 'Could not load news from Neon API.':'Could not load news from Neon API.',
 'Failed to fetch':'Failed to fetch','Could not load news from Neon API. Failed to fetch':'Could not load news from Neon API. Failed to fetch',
 'Не удалось загрузить матчи из Neon API: Failed to fetch':'Could not load matches from Neon API: Failed to fetch',
 'Не удалось загрузить трансляции из Neon API: Failed to fetch':'Could not load streams from Neon API: Failed to fetch',
 'Не удалось загрузить топ игроков. Убедись, что выполнена миграция match_history_players_setup.sql. Ошибка: Failed to fetch':'Could not load top players. Make sure match_history_players_setup.sql has been migrated. Error: Failed to fetch',
 'Не удалось загрузить турнир.':'Could not load tournament.',
 'Проверь, что таблицы турниров перенесены в Neon.':'Check that the tournament tables have been migrated to Neon.',
 'Чтобы написать сообщение администратору, войди в аккаунт или зарегистрируйся.':'To message the administrator, log in or register.',
 'Общая база подключена. Команды появятся после их переноса администратором.':'Shared database connected. Teams will appear after an administrator migrates them.',
 'Рейтинг команд':'Team ranking','Текущий сезон':'Current season',
 },
 ru:{
 'All':'Все','Site news':'Новости сайта','News сайта':'Новости сайта','Transfers':'Трансферы','Bans':'Блокировки','Close':'Закрыть',
 'News':'Новости','Top players':'Топ игроков','Streams CS2':'Трансляции CS2','Matches MVP CS2':'Матчи MVP CS2',
 'MVP CS2 Tournament Bracket':'Турнирная сетка MVP CS2','Tournamentная сетка MVP CS2':'Турнирная сетка MVP CS2',
 'Help':'Помощь','Log in':'Войти','Register':'Регистрация','Email':'Электронная почта','Password':'Пароль',
 'Forgot password?':'Забыли пароль?','Send confirmation email':'Отправить письмо подтверждения',
 'Enter your MVP CS2 Ranking account email and password':'Введите email и пароль от аккаунта MVP CS2 Ranking',
 'Team match schedule and results.':'Расписание и результаты матчей команд.',
 'YouTube live streams and recordings added by MVP CS2 Ranking administrators.':'YouTube-эфиры и записи, добавленные администрацией MVP CS2 Ranking.',
 'Players from team rosters · ranked by average K/D across recorded matches.':'Игроки из составов команд · рейтинг по среднему K/D за записанные матчи.',
 'Transfers, bans, announcements and esports community events.':'Трансферы, блокировки, объявления и события киберспортивного сообщества.',
 'Could not load news from Neon API.':'Не удалось загрузить новости из Neon API.',
 'Could not load matches from Neon API: Failed to fetch':'Не удалось загрузить матчи из Neon API: Failed to fetch',
 'Could not load streams from Neon API: Failed to fetch':'Не удалось загрузить трансляции из Neon API: Failed to fetch',
 'Could not load top players. Make sure match_history_players_setup.sql has been migrated. Error: Failed to fetch':'Не удалось загрузить топ игроков. Убедись, что выполнена миграция match_history_players_setup.sql. Ошибка: Failed to fetch',
 'Could not load tournament.':'Не удалось загрузить турнир.',
 'Check that the tournament tables have been migrated to Neon.':'Проверь, что таблицы турниров перенесены в Neon.',
 'To message the administrator, log in or register.':'Чтобы написать сообщение администратору, войди в аккаунт или зарегистрируйся.',
 },
 uk:{
 'All':'Усі','Site news':'Новини сайту','News сайта':'Новини сайту','Transfers':'Трансфери','Bans':'Блокування','Close':'Закрити',
 'News':'Новини','Top players':'Топ гравців','Streams CS2':'Трансляції CS2','Matches MVP CS2':'Матчі MVP CS2',
 'MVP CS2 Tournament Bracket':'Турнірна сітка MVP CS2','Tournamentная сетка MVP CS2':'Турнірна сітка MVP CS2',
 'Help':'Допомога','Log in':'Увійти','Register':'Реєстрація','Email':'Електронна пошта','Password':'Пароль',
 'Forgot password?':'Забули пароль?','Send confirmation email':'Надіслати лист підтвердження',
 'Enter your MVP CS2 Ranking account email and password':'Введи email і пароль від облікового запису MVP CS2 Ranking',
 'Team match schedule and results.':'Розклад і результати матчів команд.',
 'YouTube live streams and recordings added by MVP CS2 Ranking administrators.':'YouTube-трансляції та записи, додані адміністрацією MVP CS2 Ranking.',
 'Players from team rosters · ranked by average K/D across recorded matches.':'Гравці зі складів команд · рейтинг за середнім K/D у записаних матчах.',
 'Transfers, bans, announcements and esports community events.':'Трансфери, блокування, оголошення та події кіберспортивної спільноти.',
 'Could not load news from Neon API.':'Не вдалося завантажити новини з Neon API.',
 'Could not load matches from Neon API: Failed to fetch':'Не вдалося завантажити матчі з Neon API: Failed to fetch',
 'Could not load streams from Neon API: Failed to fetch':'Не вдалося завантажити трансляції з Neon API: Failed to fetch',
 'Could not load top players. Make sure match_history_players_setup.sql has been migrated. Error: Failed to fetch':'Не вдалося завантажити топ гравців. Переконайся, що виконано міграцію match_history_players_setup.sql. Помилка: Failed to fetch',
 'Could not load tournament.':'Не вдалося завантажити турнір.',
 'Check that the tournament tables have been migrated to Neon.':'Перевір, чи перенесено таблиці турнірів до Neon.',
 'To message the administrator, log in or register.':'Щоб написати адміністратору, увійди в обліковий запис або зареєструйся.',
 },
 de:{
 'All':'Alle','Site news':'Website-News','News сайта':'Website-News','Transfers':'Transfers','Bans':'Sperren','Close':'Schließen',
 'News':'Nachrichten','Top players':'Top-Spieler','Streams CS2':'CS2-Streams','Matches MVP CS2':'MVP-CS2-Spiele',
 'MVP CS2 Tournament Bracket':'MVP-CS2-Turnierbaum','Tournamentная сетка MVP CS2':'MVP-CS2-Turnierbaum',
 'Help':'Hilfe','Log in':'Anmelden','Register':'Registrieren','Email':'E-Mail','Password':'Passwort',
 'Forgot password?':'Passwort vergessen?','Send confirmation email':'Bestätigungs-E-Mail senden',
 'Enter your MVP CS2 Ranking account email and password':'Gib deine E-Mail-Adresse und dein Passwort für MVP CS2 Ranking ein',
 'Team match schedule and results.':'Spielplan und Ergebnisse der Team-Matches.',
 'YouTube live streams and recordings added by MVP CS2 Ranking administrators.':'YouTube-Livestreams und Aufzeichnungen, die von der MVP-CS2-Ranking-Administration hinzugefügt wurden.',
 'Players from team rosters · ranked by average K/D across recorded matches.':'Spieler aus Teamaufstellungen · Rangliste nach durchschnittlichem K/D in aufgezeichneten Matches.',
 'Transfers, bans, announcements and esports community events.':'Transfers, Sperren, Ankündigungen und Ereignisse der Esport-Community.',
 'Could not load news from Neon API.':'Nachrichten konnten nicht von der Neon API geladen werden.',
 'Could not load matches from Neon API: Failed to fetch':'Matches konnten nicht von der Neon API geladen werden: Failed to fetch',
 'Could not load streams from Neon API: Failed to fetch':'Streams konnten nicht von der Neon API geladen werden: Failed to fetch',
 'Could not load top players. Make sure match_history_players_setup.sql has been migrated. Error: Failed to fetch':'Top-Spieler konnten nicht geladen werden. Stelle sicher, dass match_history_players_setup.sql migriert wurde. Fehler: Failed to fetch',
 'Could not load tournament.':'Turnier konnte nicht geladen werden.',
 'Check that the tournament tables have been migrated to Neon.':'Prüfe, ob die Turniertabellen zu Neon migriert wurden.',
 'To message the administrator, log in or register.':'Um dem Administrator eine Nachricht zu senden, melde dich an oder registriere dich.',
 }
 };
 Object.keys(modalTranslations).forEach(code=>Object.assign(dictionaries[code],modalTranslations[code]));
 // Extended interface coverage for dynamically rendered sections.
 const extraTranslations={"en":{"Состав пока не указан.":"Roster not provided yet.","Состав не указан":"Roster not provided","Команда не указана":"No team specified","Все трансферы":"All transfers","Матчей пока нет.":"No matches yet.","История боёв пока пуста.":"Match history is empty.","Пока нет сообщений":"No messages yet","Пока нет зарегистрированных пользователей.":"No registered users yet.","Блокировок пока нет.":"No bans yet.","Трансферных новостей пока нет.":"No transfer news yet.","Добавить команду":"Add team","Добавить бой":"Add match","Создать матч":"Create match","Создать турнир":"Create tournament","Редактировать матч":"Edit match","Редактировать команду":"Edit team","Заблокировать":"Ban","Разблокировать":"Unban","Имя пользователя":"Username","Ник игрока":"Player nickname","Причина блокировки":"Ban reason","Ответ пользователю":"Reply to user","Чат с администратором":"Chat with administrator","Предыдущий день":"Previous day","Следующий день":"Next day","Верхняя":"Upper bracket","Нижняя":"Lower bracket","полуфинал":"semifinal","четвертьфинал":"quarterfinal","Гранд-финал":"Grand final","Чемпион определён":"Champion determined","Профиль игрока":"Player profile","Профиль":"Profile","Управление доступом":"Access management","Управление командами и очками":"Manage teams and points","Управление профилями игроков":"Manage player profiles","Управление трансляциями":"Manage streams","Выдать кубок":"Award trophy","Убрать награду":"Remove award","Забыли пароль?":"Forgot password?","Вход в аккаунт":"Log in","Регистрация":"Register","Состав команды. Прокручивайте по горизонтали":"Team roster. Scroll horizontally","Матч создан":"Match created","Матч завершён":"Match completed","Завершён":"Completed","Запланирован":"Scheduled","ОЖИДАЕТ РЕЗУЛЬТАТА":"AWAITING RESULT","ОЖИДАЕТ СТАРТА":"AWAITING START","Сохранить бой и статистику":"Save match and statistics","Пока нет добавленных трансляций. Загляни позже!":"No streams have been added yet. Check back later!","Пока нет запланированных или завершённых матчей.":"No scheduled or completed matches yet.","Пока нет трансляций.":"No streams yet.","Общая база подключена. Команды появятся после их переноса администратором.":"Shared database connected. Teams will appear after an administrator migrates them."},"uk":{"Состав пока не указан.":"Склад поки не вказано.","Состав не указан":"Склад не вказано","Команда не указана":"Команду не вказано","Все трансферы":"Усі трансфери","Матчей пока нет.":"Матчів поки немає.","История боёв пока пуста.":"Історія матчів поки порожня.","Пока нет сообщений":"Повідомлень поки немає","Пока нет зарегистрированных пользователей.":"Зареєстрованих користувачів поки немає.","Блокировок пока нет.":"Блокувань поки немає.","Трансферных новостей пока нет.":"Новин про трансфери поки немає.","Добавить команду":"Додати команду","Добавить бой":"Додати матч","Создать матч":"Створити матч","Создать турнир":"Створити турнір","Редактировать матч":"Редагувати матч","Редактировать команду":"Редагувати команду","Заблокировать":"Заблокувати","Разблокировать":"Розблокувати","Имя пользователя":"Ім’я користувача","Ник игрока":"Нік гравця","Причина блокировки":"Причина блокування","Ответ пользователю":"Відповідь користувачу","Чат с администратором":"Чат з адміністратором","Предыдущий день":"Попередній день","Следующий день":"Наступний день","Верхняя":"Верхня сітка","Нижняя":"Нижня сітка","полуфинал":"півфінал","четвертьфинал":"чвертьфінал","Гранд-финал":"Гранд-фінал","Чемпион определён":"Чемпіона визначено","Профиль игрока":"Профіль гравця","Профиль":"Профіль","Управление доступом":"Керування доступом","Управление командами и очками":"Керування командами та балами","Управление профилями игроков":"Керування профілями гравців","Управление трансляциями":"Керування трансляціями","Выдать кубок":"Видати кубок","Убрать награду":"Прибрати нагороду","Забыли пароль?":"Забули пароль?","Вход в аккаунт":"Вхід до акаунта","Регистрация":"Реєстрація","Состав команды. Прокручивайте по горизонтали":"Склад команди. Гортайте горизонтально","Матч создан":"Матч створено","Матч завершён":"Матч завершено","Завершён":"Завершено","Запланирован":"Заплановано","ОЖИДАЕТ РЕЗУЛЬТАТА":"ОЧІКУЄ РЕЗУЛЬТАТУ","ОЖИДАЕТ СТАРТА":"ОЧІКУЄ ПОЧАТКУ","Сохранить бой и статистику":"Зберегти матч і статистику","Пока нет добавленных трансляций. Загляни позже!":"Трансляцій поки немає. Завітай пізніше!","Пока нет запланированных или завершённых матчей.":"Запланованих або завершених матчів поки немає.","Пока нет трансляций.":"Трансляцій поки немає.","Общая база подключена. Команды появятся после их переноса администратором.":"Спільну базу даних підключено. Команди з’являться після перенесення адміністратором."},"de":{"Состав пока не указан.":"Aufstellung noch nicht angegeben.","Состав не указан":"Aufstellung nicht angegeben","Команда не указана":"Kein Team angegeben","Все трансферы":"Alle Transfers","Матчей пока нет.":"Noch keine Spiele.","История боёв пока пуста.":"Der Spielverlauf ist noch leer.","Пока нет сообщений":"Noch keine Nachrichten","Пока нет зарегистрированных пользователей.":"Noch keine registrierten Benutzer.","Блокировок пока нет.":"Noch keine Sperren.","Трансферных новостей пока нет.":"Noch keine Transfermeldungen.","Добавить команду":"Team hinzufügen","Добавить бой":"Match hinzufügen","Создать матч":"Match erstellen","Создать турнир":"Turnier erstellen","Редактировать матч":"Match bearbeiten","Редактировать команду":"Team bearbeiten","Заблокировать":"Sperren","Разблокировать":"Entsperren","Имя пользователя":"Benutzername","Ник игрока":"Spielername","Причина блокировки":"Sperrgrund","Ответ пользователю":"Antwort an Benutzer","Чат с администратором":"Chat mit Administrator","Предыдущий день":"Vorheriger Tag","Следующий день":"Nächster Tag","Верхняя":"Obere","Нижняя":"Untere","полуфинал":"Halbfinale","четвертьфинал":"Viertelfinale","Гранд-финал":"Großes Finale","Чемпион определён":"Champion steht fest","Профиль игрока":"Spielerprofil","Профиль":"Profil","Управление доступом":"Zugriffsverwaltung","Управление командами и очками":"Teams und Punkte verwalten","Управление профилями игроков":"Spielerprofile verwalten","Управление трансляциями":"Streams verwalten","Выдать кубок":"Pokal verleihen","Убрать награду":"Auszeichnung entfernen","Забыли пароль?":"Passwort vergessen?","Вход в аккаунт":"Anmelden","Регистрация":"Registrieren","Состав команды. Прокручивайте по горизонтали":"Teamaufstellung. Horizontal scrollen","Матч создан":"Match erstellt","Матч завершён":"Match abgeschlossen","Завершён":"Abgeschlossen","Запланирован":"Geplant","ОЖИДАЕТ РЕЗУЛЬТАТА":"ERGEBNIS AUSSTEHEND","ОЖИДАЕТ СТАРТА":"START AUSSTEHEND","Сохранить бой и статистику":"Match und Statistiken speichern","Пока нет добавленных трансляций. Загляни позже!":"Noch keine Streams hinzugefügt. Schau später wieder vorbei!","Пока нет запланированных или завершённых матчей.":"Noch keine geplanten oder abgeschlossenen Spiele.","Пока нет трансляций.":"Noch keine Streams.","Общая база подключена. Команды появятся после их переноса администратором.":"Gemeinsame Datenbank verbunden. Teams erscheinen, sobald ein Administrator sie migriert hat."}};
 Object.keys(extraTranslations).forEach(code=>Object.assign(dictionaries[code],extraTranslations[code]));

 let lang='en';
 try{const saved=localStorage.getItem(KEY);if(['en','ru','uk','de'].includes(saved))lang=saved;else localStorage.setItem(KEY,'en')}catch(_){}
 const originals=new WeakMap();
 const attrs=['placeholder','title','aria-label','alt'];
 function translateText(node){
   if(!node||node.nodeType!==Node.TEXT_NODE)return;
   if(!originals.has(node))originals.set(node,node.nodeValue);
   const source=originals.get(node);
   const dict=dictionaries[lang]||{};
   let result=source;
   const keys=Object.keys(dict).sort((a,b)=>b.length-a.length);
   for(const key of keys){
     if(key && result.includes(key))result=result.split(key).join(dict[key]);
   }
   if(node.nodeValue!==result)node.nodeValue=result;
 }
 function translateElement(el){
   if(!el||el.nodeType!==Node.ELEMENT_NODE)return;
   if(/^(SCRIPT|STYLE)$/.test(el.tagName))return;
   for(const child of el.childNodes){
     if(child.nodeType===Node.TEXT_NODE)translateText(child);
     else if(child.nodeType===Node.ELEMENT_NODE)translateElement(child);
   }
   const dict=dictionaries[lang]||{};
   for(const attr of attrs){
     if(!el.hasAttribute(attr))continue;
     const store='mvpLangOriginal'+attr;
     if(!el.dataset[store])el.dataset[store]=el.getAttribute(attr);
     const source=el.dataset[store];
     let result=source;
     const keys=Object.keys(dict).sort((a,b)=>b.length-a.length);
     for(const key of keys)if(key&&result.includes(key))result=result.split(key).join(dict[key]);
     el.setAttribute(attr,result);
   }
 }
 function syncLanguageSelect(){
   const select=document.getElementById('siteLanguageSelect');
   if(select)select.value=lang;
 }
 function apply(){
   document.documentElement.lang=lang;
   if(document.body)translateElement(document.body);
   syncLanguageSelect();
   const labels={en:'Settings',ru:'Настройки',uk:'Налаштування',de:'Einstellungen'};
   const btn=document.getElementById('settingsBtn');
   if(btn){btn.title=labels[lang];btn.setAttribute('aria-label',labels[lang])}
 }
 window.mvpGetLanguage=function(){return lang};
 window.mvpSetLanguage=function(next){
   if(!['en','ru','uk','de'].includes(next))return;
   lang=next;
   try{localStorage.setItem(KEY,lang)}catch(_){}
   apply();
   syncLanguageSelect();
 };
 document.addEventListener('change',function(e){
   if(e.target&&e.target.id==='siteLanguageSelect')window.mvpSetLanguage(e.target.value);
 });
 const observer=new MutationObserver(records=>{
   for(const record of records){
     if(record.type==='characterData')translateText(record.target);
     record.addedNodes&&record.addedNodes.forEach(node=>{
       if(node.nodeType===Node.TEXT_NODE)translateText(node);
       else if(node.nodeType===Node.ELEMENT_NODE)translateElement(node);
     });
     syncLanguageSelect();
   }
 });
 function start(){
   if(document.body){apply();observer.observe(document.body,{subtree:true,childList:true,characterData:true})}
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
 const oldModal=window.modal;
 if(typeof oldModal==='function')window.modal=function(content,wide){oldModal(content,wide);apply()};
})();
