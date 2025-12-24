package com.pace2020.epace.sdk.sample;

import java.rmi.RemoteException;
import java.util.Date;
import java.util.GregorianCalendar;
import java.util.List;
import javax.xml.datatype.DatatypeConfigurationException;
import javax.xml.datatype.DatatypeFactory;

import com.pace2020.epace.object.ChargeBackAccount;
import com.pace2020.epace.object.Customer;
import com.pace2020.epace.sdk.util.SecuredWSDLClient;

/**
 * @author <a href="mailto:jerry.duval@efi.com">jerry duval</a>
 */
public class ChargeBackAccountSample extends SecuredWSDLClient
{
    private final String m_customerCode;
    private final String m_chargeBackAccount;

    public ChargeBackAccountSample( final String customerCode, final String chargeBackAccount )
    {
        super();

        m_customerCode = customerCode;
        m_chargeBackAccount = chargeBackAccount;
    }

    public static void main( final String[] args ) throws Exception
    {
        //Check to make sure we have 2 parameters passed in
        if( args.length != 2 )
        {
            throw new Exception( "Usage: CreateJob <CUSTCODE> <CHARGEBACKACCOUNT>" );
        }
        else
        {
            final ChargeBackAccountSample chargeBackAccountSample = new ChargeBackAccountSample( args[0], args[1] );

            chargeBackAccountSample.run();
        }
    }


    public ChargeBackAccount run() throws RemoteException, DatatypeConfigurationException
    {
        // first check if the parameter for customer is valid
        if( verifyCustomerExists() )
        {
            final List<String> keys =
                getFindObjectsPortType()
                    .find( "ChargeBackAccount", "@accountNumber = '" + getChargeBackAccount() + "'" )
                    .getString();

            System.out
                .println( keys.size() + " ChargeBackAccount's with a accountNumber = " + getChargeBackAccount() + "" );

            ChargeBackAccount acct = new ChargeBackAccount();

            if( keys.size() == 1 )
            {
                // read existing account since accountNumber is unique

                acct.setId( new Integer( keys.get( 0 ) ) );

                acct = getReadObjectPortType().readChargeBackAccount( acct );

                System.out.println( "Found existing ChargeBackAccount[" + acct.getId() + "] acct number= " + acct
                    .getAccountNumber() + ", customer=" + acct.getCustomer() + ", expires= " + acct
                    .getExpirationDate() + "" );

            }
            else
            {
                // create a new one

                acct.setAccountNumber( getChargeBackAccount() );
                acct.setCustomer( getCustomerCode() );

                final GregorianCalendar gc = new GregorianCalendar();

                gc.setTime( new Date() );

                acct.setExpirationDate( DatatypeFactory.newInstance().newXMLGregorianCalendar( gc ) );

                acct = getCreateObjectPortType().createChargeBackAccount( acct );

                System.out.println( "Created new ChargeBackAccount[" + acct.getId() + "] acct number= " + acct
                    .getAccountNumber() + ", customer=" + acct.getCustomer() + ", expires= " + acct
                    .getExpirationDate() + "" );

            }
/*
            // if the current year = the same year as the expiration date, then let's extend it for a year.
            if( acct.getExpirationDate().get( Calendar.YEAR ) == Calendar.getInstance().get( Calendar.YEAR ) )
            {
                final Calendar calendar = Calendar.getInstance();

                calendar.add( Calendar.YEAR, +1 );

                acct.setExpirationDate( calendar );

                UpdateObject.updateChargeBackAccount( acct );

                System.out.println( "Extended expiration date by 1 year" );

            }*/

            return acct;
        }
        return null;
    }

    private boolean verifyCustomerExists()
    {
        try
        {
            final Customer cust = new Customer();
            cust.setId( m_customerCode );
            getReadObjectPortType().readCustomer( cust );
            return true;
        }
        catch( Exception e )
        {
            System.out
                .println( "Customer: " + getCustomerCode() + " does not exist. Please submit a valid customer code." + e
                    .getMessage() );
            return false;
        }
    }

    public String getCustomerCode()
    {
        return m_customerCode;
    }

    public String getChargeBackAccount()
    {
        return m_chargeBackAccount;
    }
}
