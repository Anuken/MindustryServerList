# Mindustry Server List

This repository contains a [JSON file](https://github.com/Anuken/MindustryServerList/blob/main/servers_v8.json) that lists all the public servers for Mindustry. This list is managed via user-submitted pull requests.

### Server list requirements
You have to meet these requirements to be accepted onto and to remain on the server list. Failure to do so will result in your server being denied to be added onto the list or removed from the list.
1. Your server must be moderated. You have to take administrative measures against griefers or other malicious players. You should not provide an unpleasant experience for your players. If you can't find enough staff, consider getting server plugins with anti-grief features.
2. You must take active action to prevent NSFW content from being on your server in any form. Get staff to watch for it, especially when hosting sandbox; if you can't, consider banning displays: `rules add bannedBlocks ["canvas", "logic-display", "large-logic-display"]`.
3. You must not discriminate against players based on race, gender, or any similar attributes. You are also expected to take action against players who engage in discrimination.
4. Your server and its staff must not partake in or condone disruptive/misleading actions against players or other servers. You must not attempt to mislead players (e.g., spoofing ping or player counts), leak UUIDs or other info, participate in DDOS attacks, raid Discord servers, or take other similar actions. You are expected to remove staff violating this rule.
5. You must not violate intellectual property rights. You must also respect requests from users to remove their content from your server (e.g., if someone asks you not to use their maps from the `#maps` channel on Discord, you have to remove those maps *and their derivatives* as per copyright standard practice).
6. You should try to be original with your server by adding new gamemodes, server mods, being a language-specific server, or in some other way. However, we may still accept you if you do not meet these criteria, depending mostly on how many similar servers there are. Up to reviewer judgement.
7. Language-specific servers must be clearly marked, in English, in your server names, or category title.
8. Vanilla clients must be able to play on your server. The server itself can be modded (plugins, source mods, etc.), but you must not require clients to install anything.
9. When adding a new category, reviewers must be able to join your server (your server has to be online) for it to be accepted. Non-24/7 servers may, however, still be accepted if this is clarified to reviewers and it's sufficiently unique.

### Server configuration
- **Consider enabling a rate limit:** `config messageRateLimit 2` will make it so that players can only send messages every 2 seconds, for example.
- **Set an appropriate MOTD, name, and description.** This is set with `config <name/desc/motd> <value>`. "Appropriate" means that:
   - Your name or description must reflect the type of server you're hosting. 
   Since new players may be exposed to the server list early on, put in a phrase like "Co-op survival" or "PvP" so players know what they're getting into. Yes, this is also displayed in the server mode info text, but having extra info in the name doesn't hurt.
   - Make sure players know where to refer to for server support. It should be fairly clear that the server owner is not me, but you.
   - Try to be professional in your text; use common sense.

### Adding a server to the list
- Finally, once you've checked for everything, **submit a pull request** to add your server's IP to the list. 
Press the edit button on the [server file](https://github.com/Anuken/MindustryServerList/blob/main/servers_v8.json), then add a JSON object with the following format:
    ```json
      {
        "name": "Your Server Group Name",
        "address": ["your.server.address"]
      }
    ```

    If your group has multiple servers, simply add extra addresses inside the square brackets, separated by commas. For example: `["address1", "address2"]`
    
    > Note that Mindustry also supports SRV records. This allows you to use a subdomain for your server address instead of specifying the port. For example, if you want to use `play.example.com` instead of `example.com:6000`, in the dns settings of your domain, add an SRV record with `_mindustry` as the service, `tcp` as the protocol, `play` as the target, and `6000` as the port. You can also set up fallback servers by modifying the weight or priority of the record. Although SRV records are very convenient, keep in mind they are slower than regular addresses. Avoid using them in the server list, but rather as an easy way to share your server address.

    Then, press the *'submit pull request'* button. Once your server is approved by maintainers, it will be added to the list.