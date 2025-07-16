package name.nxw;

import java.io.IOException;
import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Hashtable;
import javax.naming.*;
import javax.naming.directory.*;

import org.apache.commons.cli.CommandLine;
import org.apache.commons.cli.Options;
import org.apache.commons.cli.ParseException;
import org.apache.commons.cli.CommandLineParser;
import org.apache.commons.cli.HelpFormatter;
import org.apache.commons.cli.DefaultParser;
import org.xbill.DNS.SimpleResolver;
import org.xbill.DNS.Record;
import org.xbill.DNS.Type;
import org.xbill.DNS.Lookup;
import org.xbill.DNS.ARecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class App {
    private static final Logger logger = LoggerFactory.getLogger(App.class);

    public static void main(String[] args) {
        Options options = new Options();
        options.addOption("h", "hostname", true, "Hostname to resolve");
        options.addOption("l", "lib", false, "Use dnsjava library");
        options.addOption("j", "jndi", false, "Use JNDI library");

        CommandLineParser parser = new DefaultParser();
        HelpFormatter formatter = new HelpFormatter();

        String hostname = "private-test.com";
        boolean useDnsjavaLib = false;
        boolean useJndiLib = false;
        String library = "inet address";

        try {
            CommandLine cmd = parser.parse(options, args);
            if (cmd.hasOption("h")) {
                hostname = cmd.getOptionValue("h");
            }
            if (cmd.hasOption("l")) {
                useDnsjavaLib = true;
                library = "dns java";
            }
            if (cmd.hasOption("j")) {
                useJndiLib = true;
                library = "jndi";
            }
        } catch (ParseException e) {
            System.err.println("Error on parsing options: " + e.getMessage());
            formatter.printHelp("CustomDNSWithCLI", options);

            System.exit(1);
        }

        System.out.println("===== Java DNS Client =====");
        System.out.printf("hostname: %s\n", hostname);
        System.out.printf("library: %s\n", library);

        try {
            String[] addresses;
            if (useDnsjavaLib) {
                addresses = resolveHostnameUsingDnsjava(hostname);
            } else if (useJndiLib) {
                addresses = resolveHostnameUsingJDNI(hostname);
            } else {
                addresses = resolveHostname(hostname);
            }
            System.out.println("===== Result =====");
            System.out.printf("Host\t\tAddress\n");
            System.out.printf("%s\t%s\n", hostname, Arrays.toString(addresses));
        } catch (IOException e) {
            System.err.println("Error resolving hostname: " + e.getMessage());
            System.exit(1);
        }
    }

    private static String[] resolveHostname(String hostname) throws IOException {
        InetAddress inetAddress = InetAddress.getByName(hostname);
        return new String[] { inetAddress.getHostAddress() };
    }

    private static String[] resolveHostnameUsingDnsjava(String hostname) throws IOException {
        SimpleResolver resolver = new SimpleResolver();
        Lookup lookup = new Lookup(hostname, Type.A);
        lookup.setResolver(resolver);
        Record[] records = lookup.run();
        if (records == null) {
            throw new UnknownHostException("Hostname not found");
        }
        String[] addresses = Arrays.stream(records).map(record -> {
            ARecord aRecord = (ARecord) record;
            return aRecord.getAddress().getHostAddress();
        }).toArray(String[]::new);
        return addresses;
    }


    private static String[] resolveHostnameUsingJDNI(String hostname) throws IOException{

        Hashtable<String, String> env = new Hashtable<>();
        env.put(Context.INITIAL_CONTEXT_FACTORY, "com.sun.jndi.dns.DnsContextFactory");
        env.put("com.example.jndi.dns.timeout.initial", "3000");

        ArrayList<String> addresses = new ArrayList<>();

        DirContext context = null;
        try {
        context = new InitialDirContext(env);
        String[] recordTypes = { "A" };
        Attributes attrs = context.getAttributes("dns:/"+hostname, recordTypes);

        for (String recordType : recordTypes) {
            Attribute attr = attrs.get(recordType);
            if (attr != null) {
                NamingEnumeration<?> values = attr.getAll();
                while (values.hasMore()) {
                    addresses.add(values.next().toString());
                }
            }
        }
    } catch(NameNotFoundException e) {
        return new String[0];
    } catch(NamingException e) {
        throw new IOException(e);
    } finally {
        if (context != null) {
            try {
                context.close();
            } catch (NamingException e) {
                throw new IOException(e);
            }
        }
    }

        return addresses.stream().toArray(String[]::new);
    }
}
