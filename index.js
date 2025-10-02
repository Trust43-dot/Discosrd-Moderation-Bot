require('dotenv').config();
const {
    Client,
    GatewayIntentBits,
    Partials,
    EmbedBuilder,
    PermissionsBitField
} = require('discord.js');

// Load .env
const TOKEN = process.env.DISCORD_TOKEN;
let PREFIX = process.env.PREFIX || '!';
if (!TOKEN) {
    console.error('ERROR: DISCORD_TOKEN missing in .env');
    process.exit(1);
}

// Create client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Channel]
});

// On ready
client.once('ready', () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
    client.user.setActivity(`${PREFIX}help | Moderation Bot 🔧`);
});

// Helper: check permission
function memberHasPerm(member, permName) {
    return member.permissions.has(PermissionsBitField.Flags[permName]);
}

// Message Commands
client.on(`messageCreate`, async (message) => {
    if (message.author.bot) return;
    if (!message.guild) return;
    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
    const cmd = args.shift().toLowerCase();

    // Ping
    if (cmd == 'ping') {
        const sent = await message.channel.send('Pinging...');
        sent.edit(`Pong! Latency: ${sent.createdTimestamp - message.createdTimestamp}ms`);
    }

    // Kick
    else if (cmd == 'kick') {
        if (!memberHasPerm(message.member, 'KickMembers')) {
            return message.reply("❌ You don't have permission to kick members.");
        }
        const target = message.mentions.members.first();
        if (!target) return message.reply('❌ Mention a user to kick. Example: `!kick @user reason`');
        if (!target.kickable) return message.reply("❌ I can't kick that user.");
        const reason = args.slice(1).join(' ') || 'No reason provided';
        try {
            await target.kick(reason);
            message.channel.send(`✅ Kicked ${target.user.tag}. Reason: ${reason}`);
        } catch (err) {
            console.error(err);
            message.reply('❌ Failed to kick.');
        }
    }

    // Ban
    else if (cmd == 'ban') {
        if (!memberHasPerm(message.member, 'BanMembers')) {
            return message.reply("❌ You don't have permission to ban members.");
        }
        const target = message.mentions.members.first();
        if (!target) return message.reply('❌ Mention a user to ban.');
        const reason = args.slice(1).join(' ') || 'No reason provided';
        try {
            await target.ban({ reason });
            message.channel.send(`✅ Banned ${target.user.tag}. Reason: ${reason}`);
        } catch (err) {
            console.error(err);
            message.reply('❌ Failed to ban.');
        }
    }

    // Purge
    else if (cmd === 'purge' || cmd === 'clear') {
        if (!memberHasPerm(message.member, 'ManageMessages')) {
            return message.reply("❌ You don't have permission to manage messages.");
        }
        if (args[0] && args[0].toLowerCase() === 'all') {
            if (!memberHasPerm(message.member, 'ManageChannels')) {
                return message.reply("❌ You need ManageChannels permission for purge all.");
            }
            const oldChannel = message.channel;
            const position = oldChannel.position;
            try {
                const newChannel = await oldChannel.clone({
                    reason: `Purge all requested by ${message.author.tag}`
                });
                await newChannel.setPosition(position);
                await oldChannel.delete();
                const info = await newChannel.send(`✅ Purged all messages by ${message.author.tag}`);
                setTimeout(() => info.delete().catch(() => { }), 6000);
            } catch (err) {
                console.error(err);
                message.reply("❌ Failed to purge all messages.");
            }
            return;
        }
        const mentioned = message.mentions.members.first();
        let amountArg = mentioned ? args[1] : args[0];
        const amount = parseInt(amountArg, 10);
        if (!amount || amount < 1 || amount > 100) {
            return message.reply('⚠️ Enter a number between 1 and 100.');
        }
        try {
            const fetched = await message.channel.messages.fetch({ limit: 100 });
            if (mentioned) {
                const userFiltered = fetched
                    .filter(m => m.author.id === mentioned.id && (Date.now() - m.createdTimestamp) < 14 * 24 * 60 * 60 * 1000)
                    .first(amount);
                if (!userFiltered || userFiltered.length === 0) {
                    return message.reply(`❌ No recent messages from ${mentioned.user.tag}.`);
                }
                const deletable = fetched.filter(m => userFiltered.map(x => x.id).includes(m.id));
                await message.channel.bulkDelete(deletable, true);
                const reply = await message.channel.send(`✅ Deleted ${deletable.size} messages from ${mentioned.user.tag}.`);
                setTimeout(() => reply.delete().catch(() => { }), 4000);
            } else {
                const deletable = fetched
                    .filter(m => (Date.now() - m.createdTimestamp) < 14 * 24 * 60 * 60 * 1000)
                    .first(amount + 1);
                if (!deletable || deletable.length === 0) {
                    return message.reply('❌ No recent messages found.');
                }
                const deletableCollection = fetched.filter(m => deletable.map(x => x.id).includes(m.id));
                await message.channel.bulkDelete(deletableCollection, true);
                const reply = await message.channel.send(`✅ Deleted ${deletableCollection.size} messages.`);
                setTimeout(() => reply.delete().catch(() => { }), 4000);
            }
        } catch (err) {
            console.error(err);
            message.reply("❌ Could not delete messages.");
        }
    }

    // Mute
    else if (cmd === 'mute') {
        if (!memberHasPerm(message.member, 'ModerateMembers')) {
            return message.reply("❌ You don't have permission to timeout members.");
        }
        const target = message.mentions.members.first();
        if (!target) return message.reply('❌ Mention a user to mute. Example: `!mute @user 10m reason`');
        const durationArg = args[1];
        if (!durationArg) return message.reply('❌ Provide duration. Examples: `10m`, `2h`, `1d`');
        const parseDuration = (str) => {
            const match = str.match(/^(\d+)(s|m|h|d)$/);
            if (!match) return null;
            const n = parseInt(match[1], 10);
            const unit = match[2];
            const map = { s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 };
            return n * map[unit];
        };
        const ms = parseDuration(durationArg);
        if (!ms) return message.reply('❌ Invalid duration. Use s/m/h/d.');
        const reason = args.slice(2).join(' ') || 'No reason provided';
        try {
            await target.timeout(ms, reason);
            message.channel.send(`🔇 Timed out ${target.user.tag} for ${durationArg}. Reason: ${reason}`);
        } catch (err) {
            console.error(err);
            message.reply('❌ Failed to timeout member.');
        }
    }

    // Unmute
    else if (cmd === 'unmute') {
        if (!memberHasPerm(message.member, 'ModerateMembers')) {
            return message.reply("❌ You don't have permission to unmute members.");
        }
        const target = message.mentions.members.first();
        if (!target) return message.reply('❌ Mention a user to unmute.');
        try {
            await target.timeout(null);
            message.channel.send(`🔊 Unmuted ${target.user.tag}`);
        } catch (err) {
            console.error(err);
            message.reply('❌ Failed to unmute member.');
        }
    }

    // Server Info Command
    else if (cmd === 'serverinfo') {
        const guild = message.guild;
        const embed = {
            color: 0x0099ff,
            title: `📊 ${guild.name} Server Info`,
            fields: [
                { name: '🆔 Server ID', value: guild.id, inline: true },
                { name: '👑 Owner', value: `<@${guild.ownerId}>`, inline: true },
                { name: '📅 Created', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true },
                { name: '👥 Members', value: `${guild.memberCount}`, inline: true },
                { name: '📚 Channels', value: `${guild.channels.cache.size}`, inline: true },
                { name: '😎 Emojis', value: `${guild.emojis.cache.size}`, inline: true },
                { name: '🛡️ Roles', value: `${guild.roles.cache.size}`, inline: true },
                { name: '✨ Boost Level', value: `Level ${guild.premiumTier}`, inline: true },
                { name: '🚀 Boosts', value: `${guild.premiumSubscriptionCount || 0}`, inline: true }
            ],
            thumbnail: { url: guild.iconURL({ dynamic: true }) }
        };
        message.channel.send({ embeds: [embed] });
    }

    // User Info Command
    else if (cmd === 'userinfo' || cmd === 'whois') {
        const target = message.mentions.members.first() || message.member;
        const user = target.user;

        const embed = {
            color: 0x00ff00,
            title: `👤 ${user.tag}'s Info`,
            thumbnail: { url: user.displayAvatarURL({ dynamic: true, size: 256 }) },
            fields: [
                { name: '🆔 User ID', value: user.id, inline: true },
                { name: '🤖 Bot', value: user.bot ? 'Yes' : 'No', inline: true },
                { name: '📅 Account Created', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true },
                { name: '📥 Joined Server', value: `<t:${Math.floor(target.joinedTimestamp / 1000)}:R>`, inline: true },
                { name: '🎨 Roles', value: `${target.roles.cache.size - 1}`, inline: true },
                { name: '🎯 Highest Role', value: `<@&${target.roles.highest.id}>`, inline: true }
            ]
        };
        message.channel.send({ embeds: [embed] });
    }

    // Avatar Command
    else if (cmd === 'avatar' || cmd === 'av') {
        const target = message.mentions.users.first() || message.author;
        const embed = {
            color: 0x0099ff,
            title: `🖼️ ${target.tag}'s Avatar`,
            image: { url: target.displayAvatarURL({ dynamic: true, size: 512 }) },
            description: `[Download](${target.displayAvatarURL({ dynamic: true, size: 4096 })})`
        };
        message.channel.send({ embeds: [embed] });
    }

    // Role Info Command
    else if (cmd === 'roleinfo') {
        const role = message.mentions.roles.first() || message.guild.roles.cache.get(args[0]);
        if (!role) return message.reply('❌ Please mention a role or provide role ID');

        const embed = {
            color: role.color,
            title: `🎯 ${role.name} Role Info`,
            fields: [
                { name: '🆔 Role ID', value: role.id, inline: true },
                { name: '🎨 Color', value: role.hexColor, inline: true },
                { name: '👥 Members', value: `${role.members.size}`, inline: true },
                { name: '📅 Created', value: `<t:${Math.floor(role.createdTimestamp / 1000)}:R>`, inline: true },
                { name: '💫 Hoisted', value: role.hoist ? 'Yes' : 'No', inline: true },
                { name: '😎 Mentionable', value: role.mentionable ? 'Yes' : 'No', inline: true },
                { name: '🛡️ Permissions', value: role.permissions.toArray().slice(0, 10).join(', ') || 'None' }
            ]
        };
        message.channel.send({ embeds: [embed] });
    }

    // Poll System
    else if (cmd === 'poll') {
        if (!memberHasPerm(message.member, 'ManageMessages')) {
            return message.reply("❌ You need Manage Messages permission to create polls.");
        }

        const question = args.join(' ');
        if (!question) return message.reply('❌ Please provide a question for the poll.');

        const embed = {
            color: 0xffd700,
            title: '📊 Poll',
            description: question,
            fields: [
                { name: '✅ Yes', value: '0 votes', inline: true },
                { name: '❌ No', value: '0 votes', inline: true },
                { name: '🤷 Neutral', value: '0 votes', inline: true }
            ],
            footer: { text: `Poll created by ${message.author.tag}` }
        };

        const pollMessage = await message.channel.send({ embeds: [embed] });
        await pollMessage.react('✅');
        await pollMessage.react('❌');
        await pollMessage.react('🤷');

        message.delete().catch(() => { });
    }

    // Suggestion System
    else if (cmd === 'suggest') {
        const suggestion = args.join(' ');
        if (!suggestion) return message.reply('❌ Please provide your suggestion.');

        const embed = {
            color: 0x00ff00,
            title: '💡 Suggestion',
            description: suggestion,
            fields: [
                { name: 'Status', value: '📊 Under Review' }
            ],
            footer: { text: `Suggested by ${message.author.tag}` }
        };

        const suggestMessage = await message.channel.send({ embeds: [embed] });
        await suggestMessage.react('👍');
        await suggestMessage.react('👎');

        message.delete().catch(() => { });
    }

    // Calculator
    else if (cmd === 'calc' || cmd === 'calculate') {
        const expression = args.join(' ');
        if (!expression) return message.reply('❌ Please provide a mathematical expression.');

        try {
            // Safety check - only allow basic math operations
            if (!/^[0-9+\-*/().\s]+$/.test(expression)) {
                return message.reply('❌ Only numbers and basic math operators (+, -, *, /) are allowed.');
            }

            const result = eval(expression);
            message.reply(`🧮 **Calculation:** ${expression} = **${result}**`);
        } catch (err) {
            message.reply('❌ Invalid mathematical expression.');
        }
    }

    // Weather Command (requires weather API)
    else if (cmd === 'weather') {
        const city = args.join(' ');
        if (!city) return message.reply('❌ Please provide a city name.');

        // You'll need to get a free API key from openweathermap.org
        const WEATHER_API_KEY = process.env.WEATHER_API_KEY;
        if (!WEATHER_API_KEY) {
            return message.reply('❌ Weather service is currently unavailable.');
        }

        try {
            const response = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&units=metric&appid=${WEATHER_API_KEY}`);
            const data = await response.json();

            if (data.cod !== 200) {
                return message.reply('❌ City not found.');
            }

            const embed = {
                color: 0x00ff00,
                title: `🌤️ Weather in ${data.name}, ${data.sys.country}`,
                fields: [
                    { name: '🌡️ Temperature', value: `${Math.round(data.main.temp)}°C`, inline: true },
                    { name: '💨 Humidity', value: `${data.main.humidity}%`, inline: true },
                    { name: '🌬️ Wind', value: `${data.wind.speed} m/s`, inline: true },
                    { name: '📝 Condition', value: data.weather[0].description, inline: true },
                    { name: '👀 Visibility', value: `${data.visibility / 1000} km`, inline: true },
                    { name: '🔺 Pressure', value: `${data.main.pressure} hPa`, inline: true }
                ],
                thumbnail: { url: `https://openweathermap.org/img/wn/${data.weather[0].icon}@2x.png` }
            };

            message.channel.send({ embeds: [embed] });
        } catch (err) {
            console.error(err);
            message.reply('❌ Error fetching weather data.');
        }
    }
    // 8Ball Command
    else if (cmd === '8ball') {
        const question = args.join(' ');
        if (!question) return message.reply('❌ Please ask a question.');

        const responses = [
            '🎯 It is certain.',
            '🤔 It is decidedly so.',
            '✅ Without a doubt.',
            '👍 Yes definitely.',
            '🔮 You may rely on it.',
            '👀 As I see it, yes.',
            '📈 Most likely.',
            '🌈 Outlook good.',
            '✔️ Yes.',
            '👌 Signs point to yes.',
            '🤷 Reply hazy, try again.',
            '🔄 Ask again later.',
            '📵 Better not tell you now.',
            '❌ Cannot predict now.',
            '🙅 My reply is no.',
            '👎 My sources say no.',
            '💭 Outlook not so good.',
            '😬 Very doubtful.'
        ];

        const response = responses[Math.floor(Math.random() * responses.length)];
        message.reply(`🎱 **Question:** ${question}\n**Answer:** ${response}`);
    }

    // Random Number Generator
    else if (cmd === 'random' || cmd === 'roll') {
        const min = parseInt(args[0]) || 1;
        const max = parseInt(args[1]) || 100;

        if (min >= max) return message.reply('❌ Minimum must be less than maximum.');
        if (max - min > 1000000) return message.reply('❌ Range too large.');

        const result = Math.floor(Math.random() * (max - min + 1)) + min;
        message.reply(`🎲 Random number between ${min} and ${max}: **${result}**`);
    }

    // Add role to user
    if (cmd === 'add') {
        if (!memberHasPerm(message.member, 'ManageRoles')) {
            return message.reply("❌ You need Manage Roles permission to use this command.");
        }

        const target = message.mentions.members.first();
        const role = message.mentions.roles.first() || message.guild.roles.cache.get(args[2]);

        if (!target || !role) {
            return message.reply('❌ Usage: `!role add @user @role`');
        }

        if (message.guild.members.me.roles.highest.position <= role.position) {
            return message.reply("❌ I can't assign this role (my role is lower).");
        }

        try {
            await target.roles.add(role);
            const embed = new EmbedBuilder()
                .setColor(0x00ff00)
                .setDescription(`✅ Added **${role.name}** role to ${target.user.tag}`);
            message.channel.send({ embeds: [embed] });
        } catch (err) {
            console.error(err);
            message.reply('❌ Failed to add role.');
        }
    }

    // Remove role from user
    else if (cmd === 'remove') {
        if (!memberHasPerm(message.member, 'ManageRoles')) {
            return message.reply("❌ You need Manage Roles permission to use this command.");
        }

        const target = message.mentions.members.first();
        const role = message.mentions.roles.first() || message.guild.roles.cache.get(args[2]);

        if (!target || !role) {
            return message.reply('❌ Usage: `!role remove @user @role`');
        }

        try {
            await target.roles.remove(role);
            const embed = new EmbedBuilder()
                .setColor(0x00ff00)
                .setDescription(`✅ Removed **${role.name}** role from ${target.user.tag}`);
            message.channel.send({ embeds: [embed] });
        } catch (err) {
            console.error(err);
            message.reply('❌ Failed to remove role.');
        }
    }

    // List all roles
    else if (cmd === 'list') {
        const roles = message.guild.roles.cache
            .sort((a, b) => b.position - a.position)
            .map(role => role.toString())
            .slice(0, 20); // Limit to 20 roles

        const embed = new EmbedBuilder()
            .setColor(0x0099ff)
            .setTitle(`📋 Roles in ${message.guild.name}`)
            .setDescription(roles.join(', '))
            .setFooter({ text: `Total roles: ${message.guild.roles.cache.size}` });

        message.channel.send({ embeds: [embed] });
    }
    // Role Check - Check what roles a user has
    else if (cmd === 'roles' || cmd === 'checkroles') {
        const target = message.mentions.members.first() || message.member;

        const roles = target.roles.cache
            .filter(role => role.id !== message.guild.id) // Remove @everyone
            .sort((a, b) => b.position - a.position)
            .map(role => role.toString());

        const embed = new EmbedBuilder()
            .setColor(target.displayColor || 0x0099ff)
            .setTitle(`🎭 Roles for ${target.user.tag}`)
            .setDescription(roles.length > 0 ? roles.join(', ') : 'No roles')
            .addFields(
                { name: 'Total Roles', value: `${roles.length}`, inline: true },
                { name: 'Highest Role', value: `${target.roles.highest}`, inline: true },
                { name: 'Color', value: target.displayHexColor || 'Default', inline: true }
            )
            .setThumbnail(target.user.displayAvatarURL({ dynamic: true }));

        message.channel.send({ embeds: [embed] });
    }

    // Choose Command
    else if (cmd === 'choose' || cmd === 'pick') {
        const choices = args.join(' ').split(',');
        if (choices.length < 2) return message.reply('❌ Please provide at least 2 choices separated by commas.');

        const choice = choices[Math.floor(Math.random() * choices.length)].trim();
        message.reply(`🤔 I choose: **${choice}**`);
    }
    // Help Command
    else if (cmd === 'help') {
        const helpText = `
**🤖 BOT HELP MENU - ALL FEATURES**

**🔧 MODERATION COMMANDS**
\`${PREFIX}ping\` - Check bot latency
\`${PREFIX}kick @user reason\` - Kick a user
\`${PREFIX}ban @user reason\` - Ban a user
\`${PREFIX}purge <1-100>\` - Bulk delete messages
\`${PREFIX}purge @user <1-100>\` - Delete specific user's messages
\`${PREFIX}purge all\` - Delete all messages (creates new channel)
\`${PREFIX}mute @user <duration s/m/h/d> reason\` - Timeout a user
\`${PREFIX}unmute @user\` - Remove timeout from user

**📊 INFORMATION COMMANDS**
\`${PREFIX}serverinfo\` - Show server information
\`${PREFIX}userinfo @user\` - Show user information
\`${PREFIX}whois @user\` - Same as userinfo
\`${PREFIX}avatar @user\` - Show user's avatar
\`${PREFIX}av @user\` - Same as avatar
\`${PREFIX}roleinfo @role\` - Show role information

**🛠️ UTILITY COMMANDS**
\`${PREFIX}poll <question>\` - Create a poll with reactions
\`${PREFIX}suggest <suggestion>\` - Create a suggestion
\`${PREFIX}calc <expression>\` - Calculate math expression
\`${PREFIX}calculate <expression>\` - Same as calc
\`${PREFIX}weather <city>\` - Get weather information

**🎉 FUN COMMANDS**
\`${PREFIX}8ball <question>\` - Ask magic 8ball a question
\`${PREFIX}random <min> <max>\` - Generate random number
\`${PREFIX}roll <min> <max>\` - Same as random
\`${PREFIX}choose <option1, option2, ...>\` - Choose between options
\`${PREFIX}pick <option1, option2, ...>\` - Same as choose

**🎯 ROLE MANAGEMENT COMMANDS**
\`${PREFIX}role add @user @role\` - Add role to user
\`${PREFIX}role remove @user @role\` - Remove role from user
\`${PREFIX}role create <name>\` - Create new role
\`${PREFIX}role delete @role\` - Delete role
\`${PREFIX}role list\` - List all roles
\`${PREFIX}role color @role #FF0000\` - Change role color
\`${PREFIX}role giveall @role\` - Add role to all members
\`${PREFIX}autorole set @role\` - Set auto role (demo)
\`${PREFIX}roles @user\` - Check user's roles


**⚙️ BOT INFO**
Prefix: \`${PREFIX}\`
Total Commands: **20+**
Status: Online 🟢
    `.trim();

        const helpEmbed = new EmbedBuilder()
            .setColor(0x0099ff)
            .setTitle("🎯 COMPLETE BOT HELP")
            .setDescription(helpText)
            .setFooter({ text: `Requested by ${message.author.tag} | Use commands responsibly` })
            .setTimestamp();

        message.channel.send({ embeds: [helpEmbed] });
    }
}
);
client.login(TOKEN);
