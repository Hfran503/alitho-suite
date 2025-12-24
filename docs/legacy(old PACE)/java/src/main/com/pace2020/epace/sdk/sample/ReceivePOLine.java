package com.pace2020.epace.sdk.sample;

import java.math.BigDecimal;
import java.rmi.RemoteException;
import java.util.Date;
import java.util.GregorianCalendar;
import javax.xml.datatype.DatatypeConfigurationException;
import javax.xml.datatype.DatatypeFactory;

import com.pace2020.epace.object.PurchaseOrderLine;
import com.pace2020.epace.sdk.util.SecuredWSDLClient;


public class ReceivePOLine extends SecuredWSDLClient
{
    private final Integer m_poLineId;
    private final BigDecimal m_unitPrice;
    private final Double m_qtyReceived;
    private final String m_serialId;
    private final Integer m_numIds;
    private final String m_bin;

    public ReceivePOLine( final String poLineId,
                          final String unitPrice,
                          final String qtyReceived,
                          final String serialId,
                          final String numIds,
                          final String bin )
    {
        super();

        m_poLineId = new Integer( poLineId );
        m_unitPrice = new BigDecimal( unitPrice );
        m_qtyReceived = new Double( qtyReceived );
        m_serialId = serialId;
        m_numIds = new Integer( numIds );
        m_bin = bin;
    }

    public static void main( final String[] args ) throws Exception
    {
        //Check to make sure we have 6 parameters passed in
        if( args.length != 6 )
        {
            throw new Exception( "Usage: ReceivePOLine <poLineId> <unitPrice> <qtyReceived> <serialId> <numIds> <bin>" );
        }
        else
        {
            final ReceivePOLine receivePOLine =
                new ReceivePOLine( args[0], args[1], args[2], args[3], args[4], args[5] );

            receivePOLine.run();
        }
    }

    public PurchaseOrderLine run() throws RemoteException, DatatypeConfigurationException
    {
        PurchaseOrderLine line = new PurchaseOrderLine();
        line.setId( m_poLineId );

        line = getReadObjectPortType().readPurchaseOrderLine( line );
        System.out.println( "PurchaseOrderLine loaded with id - " + line.getId() );

        final GregorianCalendar gc = new GregorianCalendar();

        gc.setTime( new Date() );

        line = getInvokeActionPortType().receivePurchaseOrderLine( line,
                                                                   DatatypeFactory.newInstance()
                                                                       .newXMLGregorianCalendar( gc ),
                                                                   m_unitPrice,
                                                                   "Received by SDK",
                                                                   true,
                                                                   m_qtyReceived.doubleValue(),
                                                                   m_serialId,
                                                                   m_numIds.intValue(),
                                                                   null,
                                                                   null,
                                                                   m_bin );

        System.out.println( "In PurchaseOrderLine(" + line.getId() + "), Qty Received = " +
                                line.getQtyReceived() + " and Qty to be received = " + line.getQuantityToReceive() );

        return line;
    }
}

