/*
 * This program is copyright © 2008-2014 Eric Bishop and is distributed under the terms of the GNU GPL 
 * version 2.0 with a special clarification/exception that permits adapting the program to 
 * configure proprietary "back end" software provided that all modifications to the web interface
 * itself remain covered by the GPL. 
 * See http://gargoyle-router.com/faq.html#qfoss for more information
 */
var ovpnS=new Object(); //part of i18n

var newRouterIp=""

function saveChanges()
{
	var errorList = proofreadAll();
	if(errorList.length > 0)
	{
		errorString = errorList.join("\n") + "\n\n"+UI.ErrChanges;
		alert(errorString);
	}
	else
	{
		setControlsEnabled(false, true);
		
		var openvpnConfig = getSelectedValue("openvpn_config")
		uci.set("openvpn", "custom_config", "", "openvpn")

		configureFirewall = function(enabled,isServer,vpnPort,vpnProto)
		{
			if(enabled)
			{
				uci.set("firewall", "vpn_zone", "",        "zone")
				uci.set("firewall", "vpn_zone", "name",    "vpn")
				uci.set("firewall", "vpn_zone", "device", "tun0")
				uci.set("firewall", "vpn_zone", "input",   "ACCEPT")
				uci.set("firewall", "vpn_zone", "output",  "ACCEPT")
				uci.set("firewall", "vpn_zone", "forward", "ACCEPT")
				uci.set("firewall", "vpn_zone", "mtu_fix", "1")
				uci.set("firewall", "vpn_zone", "masq",    "1")

				uci.set("firewall", "vpn_lan_forwarding", "",     "forwarding")
				uci.set("firewall", "vpn_lan_forwarding", "src",  "lan")
				uci.set("firewall", "vpn_lan_forwarding", "dest", "vpn")

				uci.set("firewall", "lan_vpn_forwarding", "",     "forwarding")
				uci.set("firewall", "lan_vpn_forwarding", "src",  "vpn")
				uci.set("firewall", "lan_vpn_forwarding", "dest", "lan")	


				if(isServer)
				{
					uci.set("firewall", "ra_openvpn", "",            "remote_accept")
					uci.set("firewall", "ra_openvpn", "zone",        "wan")
					uci.set("firewall", "ra_openvpn", "local_port",  vpnPort)
					uci.set("firewall", "ra_openvpn", "remote_port", vpnPort)
					uci.set("firewall", "ra_openvpn", "proto",       vpnProto)
					

					uci.set("firewall", "vpn_wan_forwarding", "",     "forwarding")
					uci.set("firewall", "vpn_wan_forwarding", "src",  "vpn")
					uci.set("firewall", "vpn_wan_forwarding", "dest", "wan")

					
					if(getSelectedValue("openvpn_server_subnet_access") != "true" )
					{
						uci.removeSection("firewall", "lan_vpn_forwarding")
					}


				}
				else
				{
					uci.removeSection("firewall", "vpn_wan_forwarding")
				}
			}
			else
			{
				uci.removeSection("firewall", "vpn_zone")
				uci.removeSection("firewall", "lan_vpn_forwarding")
				uci.removeSection("firewall", "vpn_lan_forwarding")
				uci.removeSection("firewall", "vpn_wan_forwarding")
				uci.removeSection("firewall", "ra_openvpn")
			}
		}


		if(openvpnConfig == "disabled")
		{
			configureFirewall(false,false)
			uci.remove("gargoyle", "status", "openvpn_connections")
			uci.set("openvpn_gargoyle", "server", "enabled", "false")
			uci.set("openvpn_gargoyle", "client", "enabled", "false")
			uci.set("openvpn", "custom_config", "enabled", "0")
		}
		if(openvpnConfig == "server")
		{
			if(!haveDh)
			{
				var doSave = confirm(ovpnS.CryptoWaitMsg+"\n")
				if(!doSave)
				{
					setControlsEnabled(true);
					return;
				}
			}

			var prefix   = "openvpn_server_"
			var vpnPort  = document.getElementById(prefix + "port").value
			var vpnProto = getSelectedValue(prefix + "protocol")
			configureFirewall(true,true,vpnPort,vpnProto)


			uci.set("gargoyle", "status", "openvpn_connections", "500")
			uci.set("openvpn", "custom_config", "enabled", "1")
			uci.set("openvpn", "custom_config", "config", "/etc/openvpn/server.conf")
			uci.set("openvpn", "custom_config", "script_security", "2")
			uci.set("openvpn", "custom_config", "up", "/etc/openvpn.up")
			uci.set("openvpn", "custom_config", "down", "/etc/openvpn.down")
			uci.set("openvpn", "custom_config", "tls_verify", "/usr/lib/gargoyle/ovpn-cn-check.sh /etc/openvpn/verified-userlist")
			uci.set("openvpn", "custom_config", "crl_verify", "/etc/openvpn/crl.pem")

			uci.set("openvpn_gargoyle", "server", "enabled", "true")
			uci.set("openvpn_gargoyle", "client", "enabled", "false")

			uci.set("openvpn_gargoyle", "server", "internal_ip", document.getElementById(prefix + "ip").value)
			uci.set("openvpn_gargoyle", "server", "internal_mask", document.getElementById(prefix + "mask").value)
			uci.set("openvpn_gargoyle", "server", "port", vpnPort)
			uci.set("openvpn_gargoyle", "server", "proto", vpnProto)
			uci.set("openvpn_gargoyle", "server", "client_to_client", getSelectedValue(prefix + "client_to_client"))
			uci.set("openvpn_gargoyle", "server", "subnet_access", getSelectedValue(prefix + "subnet_access"))
			uci.set("openvpn_gargoyle", "server", "duplicate_cn", getSelectedValue(prefix + "duplicate_cn"))
			uci.set("openvpn_gargoyle", "server", "redirect_gateway", getSelectedValue(prefix + "redirect_gateway"))
			uci.remove("openvpn_gargoyle", "server", "extra_subnet")
			if( getSelectedValue(prefix + "subnet_access") == "true")
			{
				uci.set("openvpn_gargoyle", "server", "subnet_ip",   adjustSubnetIp(currentLanIp, currentLanMask) )
				uci.set("openvpn_gargoyle", "server", "subnet_mask", currentLanMask )

				var extraSubnets = getTableDataArray(byId('openvpn_server_extra_subnets_table'), true, false);
				if(extraSubnets.length > 0)
				{
					var extraSubnetsUci = extraSubnets.map(function(extraSubnet) {return extraSubnet[0] + "_" + extraSubnet[1]});
					uci.set("openvpn_gargoyle", "server", "extra_subnet", extraSubnetsUci);
				}
			}
			else
			{
				uci.remove("openvpn_gargoyle", "server", "subnet_ip")
				uci.remove("openvpn_gargoyle", "server", "subnet_mask")
			}
			if( getSelectedValue(prefix + "duplicate_cn") == "true" )
			{
				var vpnIp   = document.getElementById(prefix + "ip").value
				var vpnMask = document.getElementById(prefix + "mask").value
				var numericVpnIp = getNumericIp(vpnIp)
				var minIp = getNumericIp(vpnIp) & getNumericMask(vpnMask)
				var maxIp = ( ~getNumericMask(vpnMask) ) | minIp
				var pool="";
				if(numericVpnIp - minIp < maxIp-numericVpnIp)
				{
					pool = "" + numericIpToStr(numericVpnIp+1) + " " + numericIpToStr(maxIp-1) + " " + vpnMask
				}
				else
				{
					pool = "" + numericIpToStr(minIp+1) + " " + numericIpToStr(numericVpnIp-1) + " " + vpnMask
				}
				uci.set("openvpn_gargoyle", "server", "pool", pool)
			}
			else
			{
				uci.remove("openvpn_gargoyle", "server", "pool")
			}
			

			
			var cipher = getSelectedCiphers('server');
			uci.set("openvpn_gargoyle", "server", "cipher", cipher);
		}
		if(openvpnConfig == "client")
		{
			configureFirewall(true,false)
			uci.remove("gargoyle", "status", "openvpn_connections")
			uci.set("openvpn", "custom_config", "script_security", "2")
			uci.set("openvpn", "custom_config", "up", "/etc/openvpn.up")
			uci.set("openvpn", "custom_config", "down", "/etc/openvpn.down")
			uci.remove("openvpn", "custom_config", "tls_verify")
			uci.remove("openvpn", "custom_config", "crl_verify")

			if (document.getElementById("openvpn_client_manual_controls").style.display != "none")
			{
				clientManualCheckCaCertKey() 
				blockNonOpenVpn = getSelectedValue("openvpn_client_block_nonovpn");
				uci.set("openvpn_gargoyle", "client", "block_non_openvpn", blockNonOpenVpn == "block" ? true : false)
			}

		}


		var commands = uci.getScriptCommands(uciOriginal) + "\n" ;
	       	if(openvpnConfig == "server")
		{
			commands = commands + "\n. /usr/lib/gargoyle/openvpn.sh ; regenerate_server_and_allowed_clients_from_uci ;\n"
		}
		
		// If we need to restart firewall, do that before restarting openvpn
		if(commands.match(/uci.*firewall\.vpn_zone\./) || commands.match(/uci.*firewall\.vpn_lan_forwarding\./) || commands.match(/uci.*firewall\.vpn_wan_forwarding\./) || commands.match(/uci.*firewall\.ra_openvpn\./))
		{
			commands = commands + "\n/usr/lib/gargoyle/restart_network.sh ;\n"
		}
		else
		{
			commands = commands + "\n/etc/openvpn.firewall update_enabled ;\n"
		}

		// if anything in server section or client section has changed, restart openvpn
		// otherwise we're just adding client certs to a server and restart shouldn't be needed
		// unless we are adding/removing a client with a routed subnet, then we should give openvpn a kick to push the server routes
		var openvpnCurrentlyRunning = (tunIp != "" && openvpnProc != "" && (remotePing != "" || openvpnConfig == "server"))
		if(openvpnConfig == "disabled")
		{
			commands = "/etc/init.d/openvpn stop ; " + commands
		}
		else if(commands.match(/uci.*openvpn_gargoyle\.server\./) || commands.match(/uci.*openvpn_gargoyle.*subnet_ip/) || openvpnConfig == "client" || (!openvpnCurrentlyRunning) )
		{
			commands = commands + "/etc/init.d/openvpn restart ; sleep 3 ; "
		}

		if(openvpnConfig != "client")
		{
			var param = getParameterDefinition("commands", commands) + "&" + getParameterDefinition("hash", document.cookie.replace(/^.*hash=/,"").replace(/[\t ;]+.*$/, ""));
		
			var stateChangeFunction = function(req)
			{
				if(req.readyState == 4)
				{
					window.location=window.location
				}
			}
			runAjax("POST", "utility/run_commands.sh", param, stateChangeFunction);
		}
		else
		{
			document.getElementById("openvpn_client_commands").value = commands;
			document.getElementById("openvpn_client_hash").value = document.cookie.replace(/^.*hash=/,"").replace(/[\t ;]+.*$/, "");
			document.getElementById("openvpn_client_form").submit();
		}
	}
}

function clientNetMismatchQuery(expected, current, newIp)
{
	var continueFun = function(result)
	{
		if(result == UI.Cancel)
		{
			window.location=window.location
		}
		else
		{
			if(result == (ovpnS.Switch+" "+newIp))
			{
				document.getElementById("net_mismatch_action").value = "change"
				newRouterIp = newIp
			}
			if(result == ovpnS.KeepC)
			{
				document.getElementById("net_mismatch_action").value = "keep"
			}
			document.getElementById("openvpn_client_form").submit();
		}
	}
	query(ovpnS.SubMis, ovpnS.ExpSubN+" " + expected + ovpnS.ActSubN+" " + current + ".  "+ovpnS.WantQ, 
		[ ovpnS.Switch+" "+newIp, ovpnS.KeepC, UI.Cancel], continueFun );

}


function clientSaved(result)
{
	//Success value here does not need to be and should not be translated
	//it is an internal value only used for determining return status, never displayed
	if(result != "Success")
	{
		alert(UI.Err+": " + result)
		if(result == ovpnS.uc_conn_Err)
		{
			window.location=window.location
		}
	}
	else
	{
		uci = uciOriginal.clone()
		newLocation = window.location
		if(newRouterIp != "")
		{
			newLocation = newLocation.replace(currentLanIp, newRouterIp)
		}
		window.location=newLocation
	}
	document.getElementById("net_mismatch_action").value = "query"

	setControlsEnabled(true)
}

function proofreadAll()
{
	errors = [];
	if(getSelectedValue("openvpn_config") == "server")
	{
		var prefix = "openvpn_server_"
		var inputIds = [ prefix + "ip", prefix + "mask", prefix + "port" ]
		var labelIds = [ prefix + "ip_label", prefix + "mask_label", prefix + "port_label" ]
		var functions = [ validateIP, validateNetMask, validatePort  ];
		var validReturnCodes = [0,0,0]

		var errors = proofreadFields(inputIds, labelIds, functions, validReturnCodes, inputIds, document );
	
		if(errors.length == 0)
		{
			var serverPort  = document.getElementById(prefix + "port").value
			var serverProto = getSelectedValue(prefix + "protocol", document)
			var oldServerEnabled = uciOriginal.get("openvpn_gargoyle", "server", "enabled").toLowerCase()
			var oldServerProto   = uciOriginal.get("openvpn_gargoyle", "server", "proto")
			var oldServerPort    = uciOriginal.get("openvpn_gargoyle", "server", "port")
			var oldServerPortDef = [];
			if(oldServerEnabled == "true" || oldServerEnabled == 1 )
			{
				oldServerPortDef[oldServerProto] = [];
				oldServerPortDef[oldServerProto][oldServerPort] = 1
			}

			var serverPortConflict = checkForPortConflict(serverPort, serverProto, oldServerPortDef)
			if(serverPortConflict != "")
			{
				errors.push(ovpnS.SrvPrtErr+" " + serverPortConflict)
			}
		}
	}
	if(getSelectedValue("openvpn_config") == "client")
	{
		if(document.getElementById("openvpn_client_manual_controls").style.display != "none" )
		{
			var clientRemote = document.getElementById("openvpn_client_remote").value
			var clientPort   = document.getElementById("openvpn_client_port").value
			var clientConf   = document.getElementById("openvpn_client_conf_text").value
			if(clientRemote == "")
			{
				errors.push(ovpnS.SrvAddErr)
			}
			if(clientPort < 1 || clientPort > 65535)
			{
				errors.push(ovpnS.OPrtErr)
			}
			if(clientConf.match(/^[\t ]*dev[\t ]+tap.*$/i))
			{
				errors.push(ovpnS.GTAPErr);
			}
		}
	}
	return errors;
}

function clientManualCheckCaCertKey()
{
	var toAdd = "";
	var elem = document.getElementById("openvpn_client_conf_text");
	var clientConf = elem.value;
	if ("" !== document.getElementById("openvpn_client_ca_text").value && !clientConf.match(/^[\t ]*ca[\t ].*$/im))
	{
		toAdd += "\nca ca.crt";
	}
	if ("" !== document.getElementById("openvpn_client_cert_text").value && !clientConf.match(/^[\t ]*cert[\t ].*$/im))
	{
		toAdd += "\ncert cert.crt";
	}
	if ("" !== document.getElementById("openvpn_client_key_text").value && !clientConf.match(/^[\t ]*key[\t ].*$/im))
	{
		toAdd += "\nkey key.key";
	}
	if ("" !== toAdd)
	{
		elem.value += toAdd;
	}
}

function setSelectedCiphers(cipherStr,prefix)
{
	var ciphers = cipherStr.split(':');
	var cipherIdx = 1;
	var cipherSelEl = byId('openvpn_' + prefix + '_cipher_' + cipherIdx);
	while(cipherSelEl)
	{
		cipherSelEl.checked = ciphers.indexOf(cipherSelEl.value) > -1;
		cipherIdx += 1;
		cipherSelEl = byId('openvpn_' + prefix + '_cipher_' + cipherIdx);
	}
}

function getSelectedCiphers(prefix)
{
	var ciphers = [];
	var cipherIdx = 1;
	var cipherSelEl = byId('openvpn_' + prefix + '_cipher_' + cipherIdx);
	while(cipherSelEl)
	{
		if(cipherSelEl.checked)
		{
			ciphers.push(cipherSelEl.value);
		}
		cipherIdx += 1;
		cipherSelEl = byId('openvpn_' + prefix + '_cipher_' + cipherIdx);
	}
	return ciphers.length == 0 ? 'AES-256-GCM' : ciphers.join(':');
}

function resetData()
{
	var serverEnabled = uciOriginal.get("openvpn_gargoyle", "server", "enabled") 
	var clientEnabled = uciOriginal.get("openvpn_gargoyle", "client", "enabled")
	serverEnabled = serverEnabled == "true" || serverEnabled == "1" ? true : false;
	clientEnabled = clientEnabled == "true" || clientEnabled == "1" ? true : false;
	
	var openvpnMode = "disabled"
	openvpnMode = serverEnabled ? "server" : openvpnMode
	openvpnMode = clientEnabled ? "client" : openvpnMode
	setSelectedValue("openvpn_config", openvpnMode)

	document.getElementById("openvpn_config_status_container").style.display= openvpnMode == "disabled" ? "none"  : "block"
	
	if(openvpnMode != "disabled")
	{
		if( tunIp != "" && openvpnProc != "" && (remotePing != "" || openvpnMode == "server") )
		{
			setChildText("openvpn_config_status", ovpnS.RunC+", IP: " + tunIp, "#008800", true, null, document)
		}
		else if(openvpnProc != "")
		{
			setChildText("openvpn_config_status", ovpnS.RunNC, "#880000", true, null, document)
		}
		else
		{
			setChildText("openvpn_config_status", ovpnS.RunNot, "#880000", true, null, document)
		}
	}
	
	getServerVarWithDefault = function(variable, defaultDef) {
		var def = uciOriginal.get("openvpn_gargoyle", "server", variable)
		def = def == "" ? defaultDef : def
		return def
	}

	document.getElementById("openvpn_server_ip").value = getServerVarWithDefault("internal_ip", "10.8.0.1")
	document.getElementById("openvpn_server_mask").value = getServerVarWithDefault("internal_mask", "255.255.255.0")
	document.getElementById("openvpn_server_port").value = getServerVarWithDefault("port", "1194")

	
	var serverCipher  = uciOriginal.get("openvpn_gargoyle", "server", "cipher")
	if(serverCipher == "")
	{
		serverCipher = "AES-256-GCM"
	}

	setSelectedValue("openvpn_server_protocol", getServerVarWithDefault("proto", "udp"))
	setSelectedCiphers(serverCipher,'server');
	setSelectedValue("openvpn_server_client_to_client", getServerVarWithDefault("client_to_client", "false"))
	setSelectedValue("openvpn_server_subnet_access", getServerVarWithDefault("subnet_access", "false"))
	setSelectedValue("openvpn_server_duplicate_cn", getServerVarWithDefault("duplicate_cn", "false"))
	setSelectedValue("openvpn_server_redirect_gateway", getServerVarWithDefault("redirect_gateway", "true"))

	var extraSNetTableData = [];
	var extraSNets = uciOriginal.get('openvpn_gargoyle','server','extra_subnet');
	var esi;
	for(esi = 0; esi < extraSNets.length; esi++)
	{
		var extraSNet = extraSNets[esi];
		var splitData = extraSNet.split('_');
		if(splitData.length == 2)
		{
			var ip = splitData[0];
			var mask = splitData[1];
			extraSNetTableData.push([ip,mask,createButton(UI.Edit, 'btn-edit', editOvpnServerExtraSubnetsModal, false)]);
		}
	}
	var esTable = createTable([ ovpnS.SubIP, ovpnS.SubM, ""], extraSNetTableData, "openvpn_server_extra_subnets_table", true, false)
	var tableContainer = document.getElementById("openvpn_server_extra_subnets_table_container");
	while(tableContainer.firstChild != null)
	{
		tableContainer.removeChild(tableContainer.firstChild);
	}
	tableContainer.appendChild(esTable);

	var acTableData = []
	var allowedClients = uciOriginal.getAllSectionsOfType("openvpn_gargoyle", "allowed_client")
	var aci;
	for(aci=0; aci < allowedClients.length; aci++)
	{
		var rowData = []
		var id          = allowedClients[aci]
		var name        = uciOriginal.get("openvpn_gargoyle", id, "name")
		var ip          = uciOriginal.get("openvpn_gargoyle", id, "ip")
		var subnetIp   = uciOriginal.get("openvpn_gargoyle", id, "subnet_ip")
		var subnetMask = uciOriginal.get("openvpn_gargoyle", id, "subnet_mask")
		var enabled     = uciOriginal.get("openvpn_gargoyle", id, "enabled")
		var subnet = subnetIp != "" && subnetMask != "" ? subnetIp + "/" + subnetMask : ""
		var vpngateway = uciOriginal.get("openvpn_gargoyle", id, "prefer_vpngateway") == "1" ? "vpn_gateway" : uciOriginal.get('openvpn_gargoyle', 'server', 'internal_ip');

		var ipElementContainer = document.createElement("span")
		var naContainer = document.createElement("span")
		var ipContainer = document.createElement("span")
		var vpngwContainer = document.createElement("span")
		naContainer.appendChild( document.createTextNode("---") )
		naContainer.appendChild( document.createElement("br") )
		naContainer.appendChild( document.createTextNode("---") )
		ipContainer.appendChild( document.createTextNode(ip) )
		ipContainer.appendChild( document.createElement("br") )
		ipContainer.appendChild( document.createTextNode(subnet) )
		vpngwContainer.appendChild( document.createElement("br") )
		vpngwContainer.appendChild( document.createTextNode(vpngateway) )
		ipElementContainer.appendChild(naContainer)
		ipElementContainer.appendChild(ipContainer)
		ipElementContainer.appendChild(vpngwContainer)
		ipElementContainer.id = id
		


		rowData.push(name + "\n ")
		rowData.push(ipElementContainer)
		
		var controls = createAllowedClientControls(true)
		while(controls.length > 0)
		{
			rowData.push( controls.shift() )
		}

		enabled = enabled != "false" && enabled != "0" ? true : false;
		rowData[2].checked = enabled
		
		acTableData.push(rowData)
	}

	var acTable = createTable([ ovpnS.ClntN, ovpnS.IntIP, UI.Enabled, ovpnS.CfgCredFM, ovpnS.CfgCredFS, ""], acTableData, "openvpn_allowed_client_table", true, false, removeAcCallback)
	var tableContainer = document.getElementById("openvpn_allowed_client_table_container");
	while(tableContainer.firstChild != null)
	{
		tableContainer.removeChild(tableContainer.firstChild);
	}
	tableContainer.appendChild(acTable);


	var dupeCn = getSelectedValue("openvpn_server_duplicate_cn");
	dupeCn= dupeCn == "true" || dupeCn == "1"

	setAcDocumentFromUci(new UCIContainer(), "dummy", dupeCn, document.getElementById("openvpn_server_ip").value )


	//client
	var upCheckEl  = document.getElementById("openvpn_client_config_upload");
	var manCheckEl = document.getElementById("openvpn_client_config_manual");
	if(curClientConf.length >0)
	{
		manCheckEl.checked = true;
		upCheckEl.checked  = false;
		
		document.getElementById("openvpn_client_conf_text").value    = curClientConf.join("\n");
		if(curClientCa.length >0 && curClientCert.length >0 && curClientKey.length >0)
		{
			document.getElementById("openvpn_client_ca_text").value      = curClientCa.join("\n");
			document.getElementById("openvpn_client_cert_text").value    = curClientCert.join("\n");
			document.getElementById("openvpn_client_key_text").value     = curClientKey.join("\n");
			document.getElementById("openvpn_client_ta_key_text").value  = curClientTaKey.join("\n");
			var textTaCheck = document.getElementById("openvpn_client_use_ta_key_text");	
			textTaCheck.checked = curClientTaKey.length > 0 ? true : false;
		}
		if(curClientSecret.length >0)
		{
			document.getElementById("openvpn_client_auth_user_pass_text_user").value = curClientSecret[0];
			document.getElementById("openvpn_client_auth_user_pass_text_pass").value = curClientSecret[1];
		}
		var textAUPCheck = document.getElementById("openvpn_client_use_auth_user_pass_text");	
		textAUPCheck.checked = curClientSecret.length > 0 ? true : false;

		blockNonOpenVpn = uciOriginal.get("openvpn_gargoyle", "client", "block_non_openvpn")
		setSelectedValue("openvpn_client_block_nonovpn", (blockNonOpenVpn == "true" || blockNonOpenVpn == "1") ? "block" : "allowed")

		updateClientControlsFromConfigText()
	}
	else
	{
		upCheckEl.checked  = true;
		manCheckEl.checked = false;
	}

	setOpenvpnVisibility()
}

function updateClientControlsFromConfigText()
{
	var configLines = document.getElementById("openvpn_client_conf_text").value.split(/[\r\n]+/);
	var remote       = null;
	var port         = null;
	var proto        = null;
	var cipher       = null;
	var taDirection = null;

	var portFrom = "undefined";

	while(configLines.length >0)
	{
		var line = configLines.shift();
		var lineParts = line.replace(/^[\t ]+/, "").split(/[\t ]+/);
		
		if(lineParts[0].toLowerCase() == "remote")
		{
			remote = lineParts[1] != null ? lineParts[1] : remote;
			port   = lineParts[2] != null ? lineParts[2] : port;
			portFrom = (lineParts[2] != null) ? "remote" : portFrom;
		}
		else if (lineParts[0].toLowerCase() == "rport" && portFrom != "remote")
		{
			port   = lineParts[1] != null ? lineParts[2] : port;
			portFrom = (lineParts[1] != null) ? "rport" : portFrom;
		}
		else if (lineParts[0].toLowerCase() == "port" && portFrom != "remote" && portFrom != "rport")
		{
			port   = lineParts[1] != null ? lineParts[2] : port;
			portFrom = (lineParts[1] != null) ? "port" : portFrom;
		}
		else if(lineParts[0].toLowerCase() == "proto")
		{
			if(lineParts[1] != null)
			{
				proto = lineParts[1] == "udp" ? "udp" : "tcp"
			}
		}
		else if(lineParts[0].toLowerCase() == "data-ciphers")
		{
			cipher = lineParts[1] != null ? lineParts[1] : cipher;
		}
		else if(lineParts[0].toLowerCase() == "tls-auth")
		{
			taDirection = lineParts[2] != null ? lineParts[2] : "";
		}

	}
	if(remote != null)
	{
		document.getElementById("openvpn_client_remote").value = remote;
	}
	if(port != null)
	{
		document.getElementById("openvpn_client_port").value = port;
	}
	if(proto != null)
	{
		setSelectedValue("openvpn_client_protocol", proto)
	}
	if(cipher != null)
	{
		setSelectedCiphers(cipher,'client');
	}
	if(taDirection != null)
	{
		taDirection = taDirection == "1" ? "1" : "omitted"
		setSelectedValue("openvpn_client_ta_direction", taDirection )
		var taCheck = document.getElementById('openvpn_client_use_ta_key_text')
		taCheck.checked = true
		enableAssociatedField(taCheck, "openvpn_client_ta_key_text", "")
		enableAssociatedField(taCheck, "openvpn_client_ta_direction", "1")
	}
	proofreadPort(document.getElementById("openvpn_client_port"))
}

function updateClientConfigTextFromControls()
{
	var remote      = document.getElementById("openvpn_client_remote").value;
	var port        = document.getElementById("openvpn_client_port").value;
	var proto       = getSelectedValue("openvpn_client_protocol");
	var cipher      = getSelectedCiphers('client');
	var taDirection = getSelectedValue("openvpn_client_ta_direction") == "1" ? " 1" : ""

	var configLines = document.getElementById("openvpn_client_conf_text").value.split(/[\r\n]+/);
	var newLines = [];
	var foundVars = [];
	var defaultCipher = cipher == "AES-256-GCM" ? true : false;
	while(configLines.length >0)
	{
		var line = configLines.shift();
		var lineParts = line.replace(/^[\t ]+/, "").split(/[\t ]+/);
		if(lineParts[0].toLowerCase() == "remote")
		{
			line = "remote " + remote + " " + port
			foundVars["remote"] = 1
		}
		else if(lineParts[0].toLowerCase() == "proto")
		{
			line = "proto " + (proto == "tcp" ? "tcp-client" : "udp" )
			foundVars["proto"] = 1
		}
		else if(lineParts[0].toLowerCase() == "data-ciphers")
		{
			line = "data-ciphers " + cipher
			foundVars["cipher"] = 1
		}
		else if(lineParts[0].toLowerCase() == "rport" || lineParts[0].toLowerCase() == "port" )
		{
			//specify port in remote line instead of with these directives, so get rid of these lines
			line = ""
		}
		else if(lineParts[0].toLowerCase() == "tls-auth")
		{
			if( document.getElementById("openvpn_client_use_ta_key_text").checked )
			{
				lineParts[1] = lineParts[1] == null ? "ta.key" : lineParts[1]
				line = lineParts[0] + " " + lineParts[1] + taDirection
				foundVars["tls-auth"] = 1
			}
			else
			{
				line = ""
			}
		}
		newLines.push(line)
	}

	if(foundVars["cipher"] == null && (!defaultCipher) )
	{
		newLines.unshift("data-ciphers " + cipher);
	}
	if(foundVars["proto"] == null)
	{
		newLines.unshift("proto " + (proto == "tcp" ? "tcp-client" : "udp" ))
	}
	if(foundVars["remote"] == null)
	{
		newLines.unshift("remote " + remote + " " + port)
	}
	if(foundVars["tls-auth"] == null && document.getElementById("openvpn_client_use_ta_key_text").checked)
	{
		newLines.unshift("tls-auth ta.key" + taDirection)
	}

	document.getElementById("openvpn_client_conf_text").value = newLines.join("\n");

}


function createAllowedClientControls(haveDownload)
{

	var enabledCheck = createInput("checkbox")
	enabledCheck.onclick = toggleAcEnabled;
	var downloadButtonMulti = haveDownload ? createButton(ovpnS.Dload, "btn-download", downloadAcMulti, false) : createButton(ovpnS.Dload, "btn-download disabled", function(){ return; }, true ) ;
	var downloadButtonSingle = haveDownload ? createButton(ovpnS.Dload, "btn-download", downloadAcSingle, false) : createButton(ovpnS.Dload, "btn-download disabled", function(){ return; }, true ) ;

	var editButton = createButton(UI.Edit, "btn-edit", editOvpnClientModal, false)

	return [enabledCheck, downloadButtonMulti, downloadButtonSingle, editButton]
}

function createButton(text, cssClass, actionFunction, disabled)
{
	var button = createInput("button")
	button.textContent = text
	button.className = "btn btn-default " + cssClass
	button.onclick = actionFunction
	button.disabled = disabled
	return button;
}


function updateDupeCn()
{
	var serverInternalIp = document.getElementById("openvpn_server_ip").value
	var dupeCn = getSelectedValue("openvpn_server_duplicate_cn");
	dupeCn= dupeCn == "true" || dupeCn == "1"
	

	var allowedTable = document.getElementById("openvpn_allowed_client_table");
	var setNewIp = false;
	if(allowedTable != null)
	{
		var rows = allowedTable.rows;
		var ri;
		for(ri =1; ri < rows.length ; ri++)
		{
			var ipElementContainer = rows[ri].childNodes[1].firstChild;
			var id = ipElementContainer.id;
		
			if(!dupeCn && uci.get("openvpn_gargoyle", id, "ip") == "")
			{
				var serverInternalIp = document.getElementById("openvpn_server_ip").value
				var ip = getUnusedAcIp(serverInternalIp)
				uci.set("openvpn_gargoyle", id, "ip", ip)
				
				var ipContainer = ipElementContainer.childNodes[1]	
				setSingleChild(ipContainer, document.createTextNode(ip))
				ipContainer.appendChild( document.createElement("br") )
				ipContainer.appendChild( document.createTextNode("") )

				setNewIp = true
			}
		}
	}
	if(setNewIp)
	{
		var definedIps = getDefinedAcIps(true);
		definedIps[serverInternalIp] = 1
		if( definedIps[ document.getElementById('openvpn_allowed_client_ip').value ] != null )
		{
			var ip = getUnusedAcIp(serverInternalIp)
			document.getElementById('openvpn_allowed_client_ip').value = ip
		}
	}

	setOpenvpnVisibility()
}


function setOpenvpnVisibility()
{

	var originalEnabled = false
	var originalServerEnabled = uciOriginal.get("openvpn_gargoyle", "server", "enabled") 
	var originalClientEnabled = uciOriginal.get("openvpn_gargoyle", "client", "enabled")
	if(originalServerEnabled == "true" || originalServerEnabled == "1" || originalClientEnabled == "true" || originalClientEnabled == "1")
	{
		originalEnabled = true
	}

	openvpnMode = getSelectedValue("openvpn_config");
	
	
	document.getElementById("openvpn_clear_keys_container").style.display = (openvpnMode == "disabled" && (!originalEnabled)) ? "block" : "none"



	document.getElementById("openvpn_server_fieldset").style.display         = openvpnMode == "server" ? "block" : "none"
	document.getElementById("openvpn_allowed_client_fieldset").style.display = openvpnMode == "server" ? "block" : "none"
	document.getElementById("openvpn_client_fieldset").style.display         = openvpnMode == "client" ? "block" : "none"
	
	var subnetAccess = getSelectedValue('openvpn_server_subnet_access');
	document.getElementById('openvpn_server_extra_subnet_container').style.display = subnetAccess == 'true' ? 'block' : 'none';

	var dupeCn = getSelectedValue("openvpn_server_duplicate_cn");
	dupeCn= dupeCn == "true" || dupeCn == "1"

	var allowedTable = document.getElementById("openvpn_allowed_client_table");
	if(allowedTable != null)
	{
		var rows = allowedTable.rows;
		var ri;
		for(ri =1; ri < rows.length ; ri++)
		{
			var ipElementContainer = rows[ri].childNodes[1].firstChild;
			var ipChildIndex;
			for(ipChildIndex=0; ipChildIndex < ipElementContainer.childNodes.length ; ipChildIndex++)
			{
				ipElementContainer.childNodes[ipChildIndex].style.display = ((ipChildIndex == 0 || ipChildIndex == 2) && dupeCn) || (ipChildIndex > 0 && (!dupeCn)) ? "inline" : "none"
			}

		}
	}




	initializeAllowedClientVisibility(dupeCn);
	setClientVisibility()
}

function initializeAllowedClientVisibility(dupeCn)
{
	document.getElementById("openvpn_allowed_client_ip_container").style.display          = dupeCn ? "none" : "block"
	document.getElementById("openvpn_allowed_client_have_subnet_container").style.display = dupeCn ? "none" : "block"
	document.getElementById("openvpn_allowed_client_subnet_ip_container").style.display   = dupeCn ? "none" : "block"
	document.getElementById("openvpn_allowed_client_subnet_mask_container").style.display = dupeCn ? "none" : "block"
	setAllowedClientVisibility()

}

function setAllowedClientVisibility()
{
	var selectedVis = document.getElementById("openvpn_allowed_client_remote_container").style.display == "none" ? "none" : "block"
	document.getElementById("openvpn_allowed_client_remote_custom_container").style.display  = getSelectedValue("openvpn_allowed_client_remote", document) == "custom" ? selectedVis : "none";
	

	var selectedVis = document.getElementById("openvpn_allowed_client_have_subnet_container").style.display == "none" ? "none" : "block"
	document.getElementById("openvpn_allowed_client_subnet_ip_container").style.display   = getSelectedValue("openvpn_allowed_client_have_subnet", document) == "true" ? selectedVis : "none";
	document.getElementById("openvpn_allowed_client_subnet_mask_container").style.display = getSelectedValue("openvpn_allowed_client_have_subnet", document) == "true" ? selectedVis : "none";
}

function setClientVisibility()
{
	var upCheckEl  = document.getElementById("openvpn_client_config_upload");
	var manCheckEl = document.getElementById("openvpn_client_config_manual");
	if( (!upCheckEl.checked) && (!manCheckEl.checked) )
	{
		upCheckEl.checked = true;
	}
	var boolToInt = function(b) { return b ? 1 : 0 ; }
	
	var fileTaCheck = document.getElementById("openvpn_client_use_ta_key_file");
	var textTaCheck = document.getElementById("openvpn_client_use_ta_key_text");
	enableAssociatedField(fileTaCheck, "openvpn_client_ta_key_file", "")
	enableAssociatedField(textTaCheck, "openvpn_client_ta_key_text", "")
	enableAssociatedField(textTaCheck, "openvpn_client_ta_direction", "1")
	var AUPUserCheck = document.getElementById("openvpn_client_use_auth_user_pass");
	var AUPUserCheckText = document.getElementById("openvpn_client_use_auth_user_pass_text");
	enableAssociatedField(AUPUserCheck, "openvpn_client_auth_user_pass_user", "")
	enableAssociatedField(AUPUserCheck, "openvpn_client_auth_user_pass_pass", "")
	enableAssociatedField(AUPUserCheckText, "openvpn_client_auth_user_pass_text_user", "")
	enableAssociatedField(AUPUserCheckText, "openvpn_client_auth_user_pass_text_pass", "")

	var zip = getSelectedValue("openvpn_client_file_type", document) == "zip" ? 1 : 0;
	var multi = getSelectedValue("openvpn_client_file_type", document) == "multi" ? 1 : 0;
	var single = getSelectedValue("openvpn_client_file_type", document) == "single" ? 1 : 0;
	setVisibility( ["openvpn_client_zip_file_container", "openvpn_client_conf_file_container", "openvpn_client_ca_file_container", "openvpn_client_cert_file_container", "openvpn_client_key_file_container", "openvpn_client_ta_key_file_container","openvpn_client_auth_user_pass_container"], [zip, multi || single, multi, multi, multi, multi, single], ["block", "block", "block", "block", "block", "block", "block"], document)
	setVisibility( ["openvpn_client_file_controls", "openvpn_client_manual_controls"], [ boolToInt(upCheckEl.checked), boolToInt(manCheckEl.checked) ], ["block","block"], document)
	
}

function setRemoteNames(selectedRemote)
{
	var selectId = "openvpn_allowed_client_remote";
	selectedRemote = selectedRemote == null ? "" : selectedRemote;

	var names = []
	var values = []
	
	var definedDdns = uciOriginal.getAllSectionsOfType("ddns_gargoyle", "service")
	var ddi
	var selectedFound = false
	for(ddi=0; ddi < definedDdns.length; ddi++)
	{
		var enabled = uciOriginal.get("ddns_gargoyle", definedDdns[ddi], "enabled")
		var domain  = uciOriginal.get("ddns_gargoyle", definedDdns[ddi], "domain");
		var testDomain = uciOriginal.get("ddns_gargoyle", definedDdns[ddi], "test_domain");
		domain = testDomain == "" ? domain : testDomain;
		if( (enabled != "0" && enabled != "false") && domain != "")
		{
			if(values.indexOf(domain) == -1)
			{
				names.push(ovpnS.DDNS+": " + domain)
				values.push(domain)
				selectedFound = selectedRemote == domain ? true : selectedFound
			}
		}
	}
	selectedFound = (selectedRemote == currentWanIp) || selectedFound
	names.push(ovpnS.WANIP+": " + currentWanIp, ovpnS.OthIPD)
	values.push(currentWanIp, "custom")
	
	setAllowableSelections(selectId, values, names, document)
	var chosen = selectedRemote == "" ? values[0] : selectedRemote
	chosen = (!selectedFound) && selectedRemote != "" ? "custom" : selectedRemote
	setSelectedValue(selectId, chosen, document)
	if(chosen == "custom")
	{
		document.getElementById("openvpn_allowed_client_remote_custom").value = selectedRemote
	}
}

function getUnusedAcIp(serverInternalIp)
{
	var ipParts = serverInternalIp.split(/\./)
	var fourthIpPart = ipParts.pop()
	var thirdIpPart  = ipParts.pop()
	var secondIpPart = ipParts.pop()
	var firstIpPart  = ipParts.pop()

	fourthIpPart = parseInt(fourthIpPart);
	thirdIpPart  = parseInt(thirdIpPart);
	secondIpPart = parseInt(secondIpPart);
	fourthIpPart++;

	
	var candidateDefaultIp = firstIpPart + "." + secondIpPart + "." + thirdIpPart + "." + fourthIpPart

	var definedIps = getDefinedAcIps(true);
	definedIps[serverInternalIp] = 1
	while( (fourthIpPart < 255 || thirdIpPart < 255 || secondIpPart < 255) && definedIps[candidateDefaultIp] == 1)
	{
		fourthIpPart++
		if(fourthIpPart == 255)
		{
			fourthIpPart = 1
			thirdIpPart++
		}
		if(thirdIpPart == 255)
		{
			thirdIpPart = 0
			secondIpPart++
		}
		if(secondIpPart != 255)
		{	
			candidateDefaultIp = firstIpPart + "." + secondIpPart + "." + thirdIpPart + "." + fourthIpPart
		}
	}
	return candidateDefaultIp
}

function setAcDocumentFromUci(srcUci, id, dupeCn, serverInternalIp)
{
	var name = srcUci.get("openvpn_gargoyle", id, "name")
	
	if( srcUci.get("openvpn_gargoyle", id, "remote") == "" )
	{
		var allIdList = getDefinedAcIds(false)
		var allIdHash = getDefinedAcIds(true)
		var clientCount = allIdList.length +1
		name = ovpnS.Clnt + clientCount
		id = "client" + clientCount
		while(allIdHash[id] == 1)
		{
			clientCount++
			name = ovpnS.Clnt + clientCount
			id = "client" + clientCount
		}
		document.getElementById("openvpn_allowed_client_default_id").value = id
	}
	else
	{
		document.getElementById("openvpn_allowed_client_initial_id").value = id
	}

	document.getElementById("openvpn_allowed_client_name").value = name
	

	var ip = srcUci.get("openvpn_gargoyle", id, "ip")
	if(ip == "")
	{
		ip = getUnusedAcIp(serverInternalIp)

	}
	document.getElementById("openvpn_allowed_client_ip").value = ip
	
	setRemoteNames(srcUci.get("openvpn_gargoyle", id, "remote"))

	var subnetIp   = srcUci.get("openvpn_gargoyle", id, "subnet_ip")
	var subnetMask = srcUci.get("openvpn_gargoyle", id, "subnet_mask")
	var preferVpnGateway = srcUci.get("openvpn_gargoyle", id, "prefer_vpngateway") == 1 ? true : false;

	setSelectedValue("openvpn_allowed_client_have_subnet", (subnetIp != "" && subnetMask != "" ? "true" : "false"), document)
	subnetIp   = subnetIp   == "" ? "192.168.2.1" : subnetIp;
	subnetMask = subnetMask == "" ? "255.255.255.0" : subnetMask;
	document.getElementById("openvpn_allowed_client_subnet_ip").value = subnetIp
	document.getElementById("openvpn_allowed_client_subnet_mask").value = subnetMask
	document.getElementById("openvpn_allowed_client_prefer_vpngateway").checked = preferVpnGateway;

	initializeAllowedClientVisibility(dupeCn)
}

function getDefinedAcIps(retHash)
{
	var ips = []
	var allowedClients = getDefinedAcIds(false)
	var aci;
	for(aci=0; aci < allowedClients.length; aci++)
	{
		var ip = uci.get("openvpn_gargoyle", allowedClients[aci], "ip")
		if(ip != "")
		{
			if(retHash)
			{
				ips[ip] = 1;
			}
			else
			{
				ips.push(ip)
			}
		}
	}
	return ips;
}

function getDefinedAcIds(retHash)
{
	var ids = []
	var allowedClients = uci.getAllSectionsOfType("openvpn_gargoyle", "allowed_client")
	var aci;
	for(aci=0; aci < allowedClients.length; aci++)
	{
		var id = allowedClients[aci]
		var enabled = uci.get("openvpn_gargoyle", id, "enabled")
		if(enabled != "0" && enabled != "false")
		{
			if(retHash)
			{
				ids[id] = 1;
			}
			else
			{
				ids.push(id)
			}
		}
	}
	return ids;
}




function setAcUciFromDocument(id)
{
	var name = document.getElementById("openvpn_allowed_client_name").value;
	
	var ipContainer = document.getElementById("openvpn_allowed_client_ip_container")
	var ip = document.getElementById("openvpn_allowed_client_ip").value
	ip = ipContainer.style.display == "none" ? "" : ip
	
	var remote = getSelectedValue("openvpn_allowed_client_remote", document)
	remote = remote == "custom" ? document.getElementById("openvpn_allowed_client_remote_custom").value : remote
	
	var haveSubnet = getSelectedValue("openvpn_allowed_client_have_subnet", document) == "true" ? true : false
	haveSubnet     = ipContainer.style.display == "none" ? false : haveSubnet
	var subnetIp   = document.getElementById("openvpn_allowed_client_subnet_ip").value
	var subnetMask = document.getElementById("openvpn_allowed_client_subnet_mask").value
	var prefer_vpngateway = document.getElementById("openvpn_allowed_client_prefer_vpngateway").checked == true ? "1" : "0";

	var pkg = "openvpn_gargoyle"
	uci.set(pkg, id, "", "allowed_client")
	uci.set(pkg, id, "id", id)
	uci.set(pkg, id, "name", name)
	if(ip != "")
	{
		uci.set(pkg, id, "ip", ip)
	}
	else
	{
		uci.remove(pkg, id, "ip")
	}
	uci.set(pkg, id, "remote", remote)
	if(haveSubnet)
	{
		uci.set(pkg, id, "subnet_ip",   subnetIp)
		uci.set(pkg, id, "subnet_mask", subnetMask)
	}
	else
	{
		uci.remove(pkg, id, "subnet_ip")
		uci.remove(pkg, id, "subnet_mask")
	}
	uci.set(pkg, id, "prefer_vpngateway", prefer_vpngateway)
}

function getNumericIp(ip)
{
	var i = ip.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/)
	if(i)
	{
        	return (+i[1]<<24) + (+i[2]<<16) + (+i[3]<<8) + (+i[4])
	}
	return null
}

function getNumericMask(mask)
{
	if(mask.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/))
	{
		return getNumericIp(mask)
	}
	else
	{
		return -1<<(32-mask)
	}
}
function numericIpToStr(numIp)
{
	return ( (numIp>>>24) +'.' + (numIp>>16 & 255) + '.' + (numIp>>8 & 255) + '.' + (numIp & 255) );
}
function adjustSubnetIp(ip, mask)
{
	return numericIpToStr( getNumericIp(ip) & getNumericMask(mask) )
}



function validateAc(internalServerIp, internalServerMask)
{
	var validateHaveText = function(txt) {  return txt.length > 0 ? 0 : 1 }

	var prefix = "openvpn_allowed_client_"
	var inputIds = [ prefix + "name", prefix + "ip", prefix + "remote_custom", prefix + "subnet_ip", prefix + "subnet_mask" ]
	var labelIds = [ prefix + "name_label", prefix + "ip_label", prefix + "remote_label",  prefix + "have_subnet_label", prefix + "have_subnet_label" ]
	var functions = [ validateHaveText, validateIP, validateHaveText, validateIP, validateNetMask  ];
	var validReturnCodes = [0,0,0,0,0]
	var visibilityIds = [  prefix + "name_container", prefix + "ip_container", prefix + "remote_custom_container", prefix + "subnet_ip_container", prefix + "subnet_mask_container" ]

	var errors = proofreadFields(inputIds, labelIds, functions, validReturnCodes, visibilityIds, document );
	if(errors.length == 0 && document.getElementById(prefix + "ip_container").style.display != "none")
	{
		var testIp  = getNumericIp(document.getElementById(prefix + "ip").value)
		var vpnIp   = getNumericIp(internalServerIp)
		var vpnMask = getNumericMask(internalServerMask)
		if( ( testIp & vpnMask ) != ( vpnIp & vpnMask ) )
		{
			errors.push(ovpnS.ClntIntIP+" " + document.getElementById(prefix + "ip").value + " "+ovpnS.OSubErr)
		}
	}
	if(errors.length == 0 && document.getElementById(prefix + "subnet_ip_container").style.display != "none")
	{
		var subnetIpEl   = document.getElementById(prefix + "subnet_ip")
		var subnetMaskEl = document.getElementById(prefix + "subnet_mask")
		subnetIpEl.value = adjustSubnetIp(subnetIpEl.value, subnetMaskEl.value)
		if(checkSubnetConflict(subnetIpEl.value,subnetMaskEl.value))
		{
			errors.push(ovpnS.SubDup);
		}
	}


	return errors;

}


function toggleAcEnabled()
{
	var toggleRow=this.parentNode.parentNode;
	var toggleId = toggleRow.childNodes[1].firstChild.id;

	uci.set("openvpn_gargoyle", toggleId, "enabled", (this.checked? "true" : "false"));
}


function removeAcCallback(table, row)
{
	var id = row.childNodes[1].firstChild.id;
	uci.removeSection("openvpn_gargoyle", id);
}

function addAc()
{
	var errors = validateAc(document.getElementById("openvpn_server_ip").value , document.getElementById("openvpn_server_mask").value );
	if(errors.length > 0)
	{
		alert(errors.join("\n") + "\n"+ovpnS.AddCErr);
	}
	else
	{
		var name       = document.getElementById("openvpn_allowed_client_name").value
		var ip         = document.getElementById("openvpn_allowed_client_ip").value
		var subnetIp   = ""
		var subnetMask = ""
		if( getSelectedValue("openvpn_allowed_client_have_subnet", document) == "true")
		{
			subnetIp   = document.getElementById("openvpn_allowed_client_subnet_ip").value
			subnetMask = document.getElementById("openvpn_allowed_client_subnet_mask").value
		}
		var subnet = subnetIp != "" && subnetMask != "" ? subnetIp + "/" + subnetMask : ""
		var vpngateway = document.getElementById("openvpn_allowed_client_prefer_vpngateway").checked == true ? "vpn_gateway" : uciOriginal.get('openvpn_gargoyle', 'server', 'internal_ip');
	
		var id = name.replace(/[\t\r\n ]+/g, "_").toLowerCase().replace(/[^a-z0-9_-]/g, "");
		var idCount = 1;
		var testId = id
		while(uci.get("openvpn_gargoyle", testId) != "")
		{
			testId = id + "_" + idCount
			idCount++
		}
		id = testId

		setAcUciFromDocument(id)
		uci.set("openvpn_gargoyle", id, "enabled", "true")


		var ipElementContainer = document.createElement("span")
		var naContainer = document.createElement("span")
		var ipContainer = document.createElement("span")
		var vpngwContainer = document.createElement("span")
		naContainer.appendChild( document.createTextNode("---") )
		naContainer.appendChild( document.createElement("br") )
		naContainer.appendChild( document.createTextNode("---") )
		ipContainer.appendChild( document.createTextNode(ip) )
		ipContainer.appendChild( document.createElement("br") )
		ipContainer.appendChild( document.createTextNode(subnet) )
		vpngwContainer.appendChild( document.createElement("br") )
		vpngwContainer.appendChild( document.createTextNode(vpngateway) )
		ipElementContainer.appendChild(naContainer)
		ipElementContainer.appendChild(ipContainer)
		ipElementContainer.appendChild(vpngwContainer)
		ipElementContainer.id = id

		var acTable = document.getElementById("openvpn_allowed_client_table");


		var rowData = [ name, ipElementContainer ]
		var controls = createAllowedClientControls(false)
		while(controls.length > 0)
		{
			rowData.push( controls.shift() )
		}
		rowData[2].checked = true
		addTableRow(acTable, rowData, true, false, removeAcCallback);
	
		var dupeCn = getSelectedValue("openvpn_server_duplicate_cn")
		dupeCn= dupeCn == "true" || dupeCn == "1"
		setAcDocumentFromUci(new UCIContainer(), "dummy", dupeCn, document.getElementById("openvpn_server_ip").value )
		
		setOpenvpnVisibility()
		closeModalWindow('openvpn_allowed_client_modal');
	}

}

function downloadAcMulti()
{
	var downloadRow=this.parentNode.parentNode;
	var downloadId = downloadRow.childNodes[1].firstChild.id;
	var confType = "multiple-files"
	window.location="/utility/openvpn_download_credentials.sh?id=" + downloadId + "&configtype=" + confType
}

function downloadAcSingle()
{
	var downloadRow=this.parentNode.parentNode;
	var downloadId = downloadRow.childNodes[1].firstChild.id;
	var confType = "single-ovpn"
	window.location="/utility/openvpn_download_credentials.sh?id=" + downloadId + "&configtype=" + confType
}

function editAc(editRow,editId,serverInternalIp,serverInternalMask)
{
	var errors = validateAc(serverInternalIp, serverInternalMask);
	if(errors.length > 0)
	{
		alert(errors.join("\n") + "\n"+ovpnS.UpCErr);
	}
	else
	{
		var name       = document.getElementById("openvpn_allowed_client_name").value
		var ip         = document.getElementById("openvpn_allowed_client_ip").value
		var subnetIp   = ""
		var subnetMask = ""
		if( getSelectedValue("openvpn_allowed_client_have_subnet", document) == "true")
		{
			subnetIp   = document.getElementById("openvpn_allowed_client_subnet_ip").value
			subnetMask = document.getElementById("openvpn_allowed_client_subnet_mask").value
		}
		var subnet = subnetIp != "" && subnetMask != "" ? subnetIp + "/" + subnetMask : ""
		var vpngateway = document.getElementById("openvpn_allowed_client_prefer_vpngateway").checked == true ? "vpn_gateway" : uciOriginal.get('openvpn_gargoyle', 'server', 'internal_ip');

		setAcUciFromDocument(editId)
					
		while( editRow.childNodes[0].firstChild != null)
		{
			editRow.childNodes[0].removeChild( editRow.childNodes[0].firstChild )
		}
		editRow.childNodes[0].appendChild(document.createTextNode(name))

		var ipElementContainer = document.createElement("span")
		var naContainer = document.createElement("span")
		var ipContainer = document.createElement("span")
		var vpngwContainer = document.createElement("span")
		naContainer.appendChild( document.createTextNode("---") )
		naContainer.appendChild( document.createElement("br") )
		naContainer.appendChild( document.createTextNode("---") )
		ipContainer.appendChild( document.createTextNode(ip) )
		ipContainer.appendChild( document.createElement("br") )
		ipContainer.appendChild( document.createTextNode(subnet) )
		vpngwContainer.appendChild( document.createElement("br") )
		vpngwContainer.appendChild( document.createTextNode(vpngateway) )
		ipElementContainer.appendChild(naContainer)
		ipElementContainer.appendChild(ipContainer)
		ipElementContainer.appendChild(vpngwContainer)
		ipElementContainer.id = editId

		while( editRow.childNodes[1].firstChild != null)
		{
			editRow.childNodes[1].removeChild( editRow.childNodes[1].firstChild )
		}
						
		editRow.childNodes[1].appendChild( ipElementContainer )
		setOpenvpnVisibility()
		closeModalWindow('openvpn_allowed_client_modal');
	}
}
function clearOpenvpnKeys()
{
	var confirmed = confirm(ovpnS.OClrC)
	if(confirmed)
	{
		setControlsEnabled(false, true);

		var commands = "rm -rf /etc/openvpn/* ; ln -s /var/run/openvpn_status /etc/openvpn/current_status ;"
		var param = getParameterDefinition("commands", commands) + "&" + getParameterDefinition("hash", document.cookie.replace(/^.*hash=/,"").replace(/[\t ;]+.*$/, ""));
		var stateChangeFunction = function(req)
		{
			if(req.readyState == 4)
			{
				window.location=window.location
			}
		}
		runAjax("POST", "utility/run_commands.sh", param, stateChangeFunction);
	}
}

function addOvpnClientModal()
{
	modalButtons = [
		{"title" : UI.Add, "classes" : "btn btn-primary", "function" : addAc},
		"defaultDismiss"
	];

	modalElements = [];
	var dupeCn = getSelectedValue("openvpn_server_duplicate_cn")
	dupeCn= dupeCn == "true" || dupeCn == "1"
	setAcDocumentFromUci(new UCIContainer(), "dummy", dupeCn, document.getElementById("openvpn_server_ip").value )
	modalPrepare('openvpn_allowed_client_modal', ovpnS.CfgCred, modalElements, modalButtons);
	openModalWindow('openvpn_allowed_client_modal');
}

function editOvpnClientModal()
{
	editRow=this.parentNode.parentNode;
	var editId = editRow.childNodes[1].firstChild.id;
	var dupeCn = getSelectedValue("openvpn_server_duplicate_cn");
	dupeCn = dupeCn == "true" || dupeCn == "1";
	var serverInternalIp = document.getElementById("openvpn_server_ip").value;
	var serverInternalMask = document.getElementById("openvpn_server_mask").value;

	modalButtons = [
		{"title" : UI.CApplyChanges, "classes" : "btn btn-primary", "function" : function(){editAc(editRow,editId,serverInternalIp,serverInternalMask);}},
		"defaultDiscard"
	];

	modalElements = [];

	setAcDocumentFromUci(uci, editId, dupeCn, serverInternalIp);

	modalPrepare('openvpn_allowed_client_modal', ovpnS.EditOCS, modalElements, modalButtons);
	openModalWindow('openvpn_allowed_client_modal');
}

function togglePass(name)
{
	password_field = document.getElementById(name);
	if(password_field.type == 'password')
	{
		password_field.type = 'text';
	}
	else
	{
		password_field.type = 'password';
	}
}

// Returns true if there is a conflict, false otherwise
function checkSubnetConflict(ip,mask)
{
	var ipList = [];
	// OpenVPN IP/subnet
	var ovpnIp = byId('openvpn_server_ip').value;
	var ovpnMask = byId('openvpn_server_mask').value;
	var adjOvpnIp = adjustSubnetIp(ovpnIp,ovpnMask);
	ipList.push(adjOvpnIp);

	// Client IP/subnets
	var clientIds = uci.getAllSectionsOfType('openvpn_gargoyle','allowed_client');
	clientIds.forEach(function(clientId) {
		var clientIp = uci.get('openvpn_gargoyle',clientId,'subnet_ip');
		var clientMask = uci.get('openvpn_gargoyle',clientId,'subnet_mask');

		if(clientIp != '' && clientMask != '')
		{
			var adjClientIp = adjustSubnetIp(clientIp,clientMask);
			ipList.push(adjClientIp);
		}
	});

	// Additional Subnets
	var extraSubnets = getTableDataArray(byId('openvpn_server_extra_subnets_table'), true, false);
	if(extraSubnets.length > 0)
	{
		var adjExtraSubnetIps = extraSubnets.map(function(extraSubnet) {return adjustSubnetIp(extraSubnet[0],extraSubnet[1])});
		ipList = ipList.concat(adjExtraSubnetIps);
	}


	var adjCheckIp = adjustSubnetIp(ip,mask);
	return ipList.indexOf(adjCheckIp) >= 0;
}

function addEs()
{
	var subnetIp = document.getElementById("openvpn_extra_subnet_ip").value;
	var subnetMask = document.getElementById("openvpn_extra_subnet_mask").value;
	var inputIds = [ "openvpn_extra_subnet_ip", "openvpn_extra_subnet_mask" ]
	var labelIds = [ "openvpn_extra_subnet_ip_label", "openvpn_extra_subnet_mask_label" ]
	var functions = [ validateIP, validateNetMask ];
	var validReturnCodes = [0,0]

	var errors = proofreadFields(inputIds, labelIds, functions, validReturnCodes, inputIds, document );
	if(errors.length > 0)
	{
		alert(errors.join("\n") + "\n"+ovpnS.AddESnetErr);
	}
	else if(checkSubnetConflict(subnetIp,subnetMask))
	{
		alert(ovpnS.SubDup+"\n\n"+ovpnS.AddESnetErr);
	}
	else
	{
		var adjIp = adjustSubnetIp(subnetIp,subnetMask);
		var esTable = document.getElementById("openvpn_server_extra_subnets_table");

		var rowData = [ adjIp, subnetMask, createButton(UI.Edit, 'btn-edit', editOvpnServerExtraSubnetsModal, false) ]
		addTableRow(esTable, rowData, true, false);
	
		closeModalWindow('openvpn_server_extra_subnet_modal');
	}

}

function editEs(editRow)
{
	var newIp = document.getElementById("openvpn_extra_subnet_ip").value;
	var newMask = document.getElementById("openvpn_extra_subnet_mask").value;
	var inputIds = [ "openvpn_extra_subnet_ip", "openvpn_extra_subnet_mask" ]
	var labelIds = [ "openvpn_extra_subnet_ip_label", "openvpn_extra_subnet_mask_label" ]
	var functions = [ validateIP, validateNetMask ];
	var validReturnCodes = [0,0]

	var errors = proofreadFields(inputIds, labelIds, functions, validReturnCodes, inputIds, document );
	if(errors.length > 0)
	{
		alert(errors.join("\n") + "\n"+ovpnS.AddESnetErr);
	}
	else if(checkSubnetConflict(newIp,newMask))
	{
		alert(ovpnS.SubDup+"\n\n"+ovpnS.AddESnetErr);
	}
	else
	{
		//update document with new data
		var adjNewIp = adjustSubnetIp(newIp,newMask);
		editRow.childNodes[0].firstChild.data = adjNewIp;
		editRow.childNodes[1].firstChild.data = newMask;
		closeModalWindow('openvpn_server_extra_subnet_modal');
	}
}

function editOvpnServerExtraSubnetsModal()
{
	editRow=this.parentNode.parentNode;

	modalButtons = [
		{"title" : UI.CApplyChanges, "classes" : "btn btn-primary", "function" : function(){editEs(editRow);}},
		"defaultDiscard"
	];

	var ip = editRow.childNodes[0].firstChild.data;
	var mask = editRow.childNodes[1].firstChild.data;

	modalElements = [
		{"id" : "openvpn_extra_subnet_ip", "value" : ip},
		{"id" : "openvpn_extra_subnet_mask", "value" : mask}
	];

	modalPrepare('openvpn_server_extra_subnet_modal', ovpnS.EditES, modalElements, modalButtons);
	openModalWindow('openvpn_server_extra_subnet_modal');
}

function addOvpnServerExtraSubnetsModal()
{
	modalButtons = [
		{"title" : UI.Add, "classes" : "btn btn-primary", "function" : addEs},
		"defaultDismiss"
	];

	var ip = "";
	var mask = "";

	modalElements = [
		{"id" : "openvpn_extra_subnet_ip", "value" : ip},
		{"id" : "openvpn_extra_subnet_mask", "value" : mask}
	];

	modalPrepare('openvpn_server_extra_subnet_modal', ovpnS.SASnetAdd, modalElements, modalButtons);
	openModalWindow('openvpn_server_extra_subnet_modal');
}
