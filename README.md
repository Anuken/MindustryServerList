# Mindustry Server List

This repository contains a [JSON file](https://github.com/Anuken/MindustryServerList/blob/main/servers_v8.json) that lists all the public servers for Mindustry. This list is managed via user-submitted pull requests.

### Requirements
Your server must meet all of these requirements to be added to the list and to stay on it. Servers that fail to meet them may be denied or removed.
1. **Active moderation.** Take action against griefers and other malicious players. Players should not have an unpleasant experience. If you can't find enough staff, consider plugins with anti-grief features.
2. **No NSFW content.** Actively prevent NSFW content in any form, especially on sandbox servers. If you lack the staff to watch for it, consider banning displays:
   `rules add bannedBlocks ["canvas", "large-canvas", "logic-display", "large-logic-display", "tile-logic-display"]`
3. **No discrimination.** Do not discriminate against players based on race, gender, or similar attributes, and take action against players who do.
4. **No disruptive or misleading behavior.** Neither your server nor its staff may take part in or condone actions that disrupt or mislead players or other servers. This includes:
   - spoofing ping or player counts
   - leaking UUIDs or other player information
   - taking part in DDoS attacks
   - raiding Discord servers

   Remove any staff member who violates this rule.
5. **Respect intellectual property.** Do not violate intellectual property rights. If a user asks you to remove their content (for example, maps from the `#maps` channel on Discord), remove it *and its derivatives*, in line with standard copyright practice.
6. **Vanilla clients must be able to join.** The server itself may be modded (plugins, source mods, etc.), but players must not be required to install anything.
7. **Language-specific servers are clearly marked.** State the language, in English, in the server name or category title.
8. **Originality.** Try to stand out, for example through new gamemodes, server mods, or by being a language-specific server. Servers that don't meet this may still be accepted, depending mostly on how many similar servers are already listed.
9. **Servers must be online.** Reviewers must be able to join your server (your server has to be online) for it to be accepted. Non-24/7 servers may, however, still be accepted if this is clarified with reviewers and it's sufficiently unique.

### Server configuration
- **Set an appropriate MOTD, name, and description.** This is set with `config <name/desc/motd> <value>`. "Appropriate" means that:
   - **Your name or description must reflect the type of server you're hosting.** 
   Since new players may be exposed to the server list early on, put in a phrase like "Co-op survival" or "PvP" so players know what they're getting into. Yes, this is also displayed in the server mode info text, but having extra info in the name doesn't hurt.
   - **Make sure players know where to refer to for server support.** It should be fairly clear that the server owner is not me, but you.
   - **Stay professional.** Use common sense.

### Submitting your server
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